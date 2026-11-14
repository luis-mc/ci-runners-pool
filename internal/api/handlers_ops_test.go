package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/audit"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backup"
)

type opsEnv struct {
	mux *http.ServeMux
	ops *backup.Ops
	dir string
}

func newOpsEnv(t *testing.T) *opsEnv {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	t.Cleanup(cancel)
	dir := t.TempDir()
	db, err := backup.OpenDB(ctx, dir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	var mux *http.ServeMux
	ops := backup.Start(ctx, backup.StartOptions{
		DB: db, DataDir: dir, ConfigFile: filepath.Join(dir, "config.toml"), Version: "test", Logger: log,
		DrillHandler: func(d *backup.DB) http.Handler {
			m := http.NewServeMux()
			Register(m, Options{Version: "test", DB: d, Logger: log})
			return m
		},
	})
	mux = http.NewServeMux()
	Register(mux, Options{Version: "test", DB: db, Logger: log, Settings: ops.Settings, Audit: ops.Audit, Backup: ops.Backup})
	return &opsEnv{mux: mux, ops: ops, dir: dir}
}

func (e *opsEnv) do(method, target, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequestWithContext(audit.WithActor(context.Background(), audit.Actor{Login: "octo", ID: "7", Source: audit.SourceWeb}),
		method, target, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	e.mux.ServeHTTP(rec, req)
	return rec
}

func TestSettingsGetAndPatch(t *testing.T) {
	e := newOpsEnv(t)
	rec := e.do("GET", "/api/v1/settings", "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"retention_audit_days":400`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	rec = e.do("PATCH", "/api/v1/settings", `{"retention_audit_days":500,"backup_time_local":"04:15"}`)
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), `"retention_audit_days":500`) || !strings.Contains(rec.Body.String(), "04:15") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	// Out of range: 400 with the range, nothing changed.
	rec = e.do("PATCH", "/api/v1/settings", `{"retention_logs_days":500}`)
	if rec.Code != 400 || !strings.Contains(rec.Body.String(), "between 1 and 90") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	assertEnvelope(t, rec, CodeBadRequest)
	if rec := e.do("GET", "/api/v1/settings", ""); !strings.Contains(rec.Body.String(), `"retention_logs_days":14`) {
		t.Fatalf("a refused change was applied: %s", rec.Body)
	}
}

func TestEveryWriteHandlerRecords(t *testing.T) {
	e := newOpsEnv(t)
	e.do("PATCH", "/api/v1/settings", `{"max_event_streams":60}`)
	e.do("POST", "/api/v1/backups", "")
	e.do("POST", "/api/v1/backups/drills", "")
	rec := e.do("GET", "/api/v1/audit?limit=50", "")
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	var page struct {
		Items []struct {
			Action, Actor, Source, Result string
		}
		NextCursor *string `json:"next_cursor"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	got := map[string]bool{}
	for _, it := range page.Items {
		if it.Actor != "octo" || it.Source != "web" || it.Result != "done" {
			t.Errorf("row not attributed to the request's actor: %+v", it)
		}
		got[it.Action] = true
	}
	for _, a := range []string{"settings.update", "backup.run", "backup.drill"} {
		if !got[a] {
			t.Errorf("no audit row for %s: %v", a, got)
		}
	}
	// Filter by action, bad cursor.
	if rec := e.do("GET", "/api/v1/audit?action=backup.run", ""); strings.Count(rec.Body.String(), `"action"`) != 1 {
		t.Errorf("action filter: %s", rec.Body)
	}
	if rec := e.do("GET", "/api/v1/audit?cursor=zzz", ""); rec.Code != 400 {
		t.Errorf("bad cursor: %d", rec.Code)
	}
}

func TestBackupsListRunDrillRestore(t *testing.T) {
	e := newOpsEnv(t)
	rec := e.do("POST", "/api/v1/backups", "")
	if rec.Code != 202 || !strings.Contains(rec.Body.String(), `"state":"good"`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	var b struct{ ID string }
	_ = json.Unmarshal(rec.Body.Bytes(), &b)
	rec = e.do("GET", "/api/v1/backups", "")
	if rec.Code != 200 || !strings.Contains(rec.Body.String(), b.ID) || !strings.Contains(rec.Body.String(), `"check_result":"ok"`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	rec = e.do("POST", "/api/v1/backups/drills", "")
	if rec.Code != 202 || !strings.Contains(rec.Body.String(), `"state":"passed"`) {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}

	// Restore without confirm: 409 needs_confirmation naming what goes.
	rec = e.do("POST", "/api/v1/backups/"+b.ID+"/restore", "")
	if rec.Code != 409 || !strings.Contains(rec.Body.String(), "needs_confirmation") || !strings.Contains(rec.Body.String(), "the database") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if strings.Contains(rec.Body.String(), e.dir) {
		t.Fatalf("the answer names a server path: %s", rec.Body)
	}
	// Confirmed: 202.
	rec = e.do("POST", "/api/v1/backups/"+b.ID+"/restore?confirm=true", "")
	if rec.Code != 202 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	if rec := e.do("POST", "/api/v1/backups/nope/restore?confirm=true", ""); rec.Code != 404 {
		t.Fatalf("unknown backup: %d", rec.Code)
	}
}

func TestDrillWithoutBackupIsAConflict(t *testing.T) {
	e := newOpsEnv(t)
	rec := e.do("POST", "/api/v1/backups/drills", "")
	if rec.Code != 409 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	assertEnvelope(t, rec, CodeConflict)
}
