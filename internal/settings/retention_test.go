package settings

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/audit"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

func retention(t *testing.T) (*Retention, *audit.Log, string) {
	t.Helper()
	dir := t.TempDir()
	db, err := store.Open(context.Background(), dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	l := audit.New(db)
	return &Retention{DB: db, Settings: New(db), Audit: l, DataDir: dir}, l, dir
}

func TestHourlyJobDeletesPastLimit(t *testing.T) {
	ctx := context.Background()
	r, l, dir := retention(t)
	_ = l.Record(ctx, audit.System, "old.thing", audit.Target{}, nil)

	logs := filepath.Join(dir, LogsDir)
	_ = os.MkdirAll(filepath.Join(logs, "m1"), 0o755)
	old := filepath.Join(logs, "m1", "old.log")
	fresh := filepath.Join(logs, "m1", "fresh.log")
	_ = os.WriteFile(old, []byte("x"), 0o600)
	_ = os.WriteFile(fresh, []byte("y"), 0o600)
	past := time.Now().Add(-20 * 24 * time.Hour)
	_ = os.Chtimes(old, past, past)

	// Today: audit (400 days) keeps its row; logs (14 days) lose the old file.
	if err := r.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(old); err == nil {
		t.Error("a log older than 14 days stayed")
	}
	if _, err := os.Stat(fresh); err != nil {
		t.Error("a fresh log was deleted")
	}
	p, _ := l.List(ctx, audit.Filter{Action: "old.thing"})
	if len(p.Items) != 1 {
		t.Fatal("audit row deleted too early")
	}

	// 401 days later the audit row is past its limit; retention writes its own row.
	r.Now = func() time.Time { return time.Now().Add(401 * 24 * time.Hour) }
	if err := r.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	if p, _ := l.List(ctx, audit.Filter{Action: "old.thing"}); len(p.Items) != 0 {
		t.Error("an audit row past 400 days stayed")
	}
	p, _ = l.List(ctx, audit.Filter{Action: "audit.retention"})
	if len(p.Items) == 0 {
		t.Fatal("retention wrote no row")
	}
}

func TestRetentionUsesSettings(t *testing.T) {
	ctx := context.Background()
	r, l, _ := retention(t)
	_ = l.Record(ctx, audit.System, "thing", audit.Target{}, nil)
	days := 90 // the audit floor
	if _, err := r.Settings.Update(ctx, owner, Patch{RetentionAuditDays: &days}); err != nil {
		t.Fatal(err)
	}
	r.Now = func() time.Time { return time.Now().Add(95 * 24 * time.Hour) }
	if err := r.RunOnce(ctx); err != nil {
		t.Fatal(err)
	}
	if p, _ := l.List(ctx, audit.Filter{Action: "thing"}); len(p.Items) != 0 {
		t.Error("the changed limit was not used")
	}
}

func TestLogSizeCapPerMachineOldestFirst(t *testing.T) {
	dir := t.TempDir()
	_ = os.MkdirAll(filepath.Join(dir, "m1"), 0o755)
	_ = os.MkdirAll(filepath.Join(dir, "m2"), 0o755)
	mk := func(p string, size int, age time.Duration) {
		_ = os.WriteFile(p, []byte(strings.Repeat("a", size)), 0o600)
		at := time.Now().Add(-age)
		_ = os.Chtimes(p, at, at)
	}
	mk(filepath.Join(dir, "m1", "a"), 600, 3*time.Hour)
	mk(filepath.Join(dir, "m1", "b"), 600, 2*time.Hour)
	mk(filepath.Join(dir, "m1", "c"), 600, time.Hour)
	mk(filepath.Join(dir, "m2", "a"), 600, 3*time.Hour)
	mk(filepath.Join(dir, "top.log"), 5000, time.Hour)
	if err := PruneLogs(dir, time.Now().Add(-24*time.Hour), 1300); err != nil {
		t.Fatal(err)
	}
	exists := func(p string) bool { _, err := os.Stat(filepath.Join(dir, p)); return err == nil }
	if exists("m1/a") || !exists("m1/b") || !exists("m1/c") {
		t.Error("m1 must lose only its oldest file")
	}
	if !exists("m2/a") || !exists("top.log") {
		t.Error("another machine's logs and the top folder must stay")
	}
	if err := PruneLogs(filepath.Join(dir, "missing"), time.Now(), 1); err != nil {
		t.Errorf("a missing folder is not an error: %v", err)
	}
}

func TestRunRepeats(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	r, _, dir := retention(t)
	r.Interval = 20 * time.Millisecond
	go r.Run(ctx)
	// A file that turns old after the first run is deleted by a later run.
	time.Sleep(100 * time.Millisecond)
	logs := filepath.Join(dir, LogsDir)
	_ = os.MkdirAll(logs, 0o755)
	old := filepath.Join(logs, "late.log")
	_ = os.WriteFile(old, []byte("x"), 0o600)
	past := time.Now().Add(-30 * 24 * time.Hour)
	_ = os.Chtimes(old, past, past)
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		if _, err := os.Stat(old); err != nil {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("retention did not run again")
}
