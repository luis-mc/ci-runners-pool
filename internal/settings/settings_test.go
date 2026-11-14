package settings

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/audit"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

func setup(t *testing.T) (*Service, *audit.Log) {
	t.Helper()
	db, err := store.Open(context.Background(), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	return New(db), audit.New(db)
}

func ip(v int) *int { return &v }

var owner = audit.Actor{Login: "octo", ID: "1", Source: audit.SourceWeb}

func TestDefaultsAreTheOwnerDecisions(t *testing.T) {
	s, _ := setup(t)
	got, err := s.Get(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if got.RetentionJobHistoryDays != 90 || got.RetentionLogsDays != 14 || got.RetentionLogsMiBPerMachine != 512 ||
		got.RetentionAuditDays != 400 || got.BackupTimeLocal != "03:00" || got.BackupKeepDays != 14 {
		t.Fatalf("%+v", got)
	}
}

func TestUpdateSavesAndAudits(t *testing.T) {
	ctx := context.Background()
	s, l := setup(t)
	tm := "04:30"
	got, err := s.Update(ctx, owner, Patch{RetentionAuditDays: ip(500), BackupTimeLocal: &tm})
	if err != nil {
		t.Fatal(err)
	}
	if got.RetentionAuditDays != 500 || got.BackupTimeLocal != "04:30" || got.RetentionLogsDays != 14 {
		t.Fatalf("%+v", got)
	}
	again, _ := s.Get(ctx)
	if again != got {
		t.Fatalf("not persisted: %+v vs %+v", again, got)
	}
	p, _ := l.List(ctx, audit.Filter{})
	if len(p.Items) != 1 || p.Items[0].Action != "settings.update" || p.Items[0].Actor != "octo" ||
		!strings.Contains(p.Items[0].Summary, "400 -> 500") || !strings.Contains(p.Items[0].Summary, "03:00 -> 04:30") {
		t.Fatalf("%+v", p.Items)
	}
	// No change, no audit row.
	if _, err := s.Update(ctx, owner, Patch{RetentionAuditDays: ip(500)}); err != nil {
		t.Fatal(err)
	}
	if p, _ := l.List(ctx, audit.Filter{}); len(p.Items) != 1 {
		t.Fatalf("a no-op wrote a row: %d", len(p.Items))
	}
}

func TestOutOfRangeRefusedWithRange(t *testing.T) {
	ctx := context.Background()
	s, l := setup(t)
	bad := "25:00"
	_, err := s.Update(ctx, owner, Patch{RetentionLogsDays: ip(0), RetentionAuditDays: ip(30), BackupKeepDays: ip(14), BackupTimeLocal: &bad})
	var re *RangeError
	if !errors.As(err, &re) || len(re.Problems) != 3 {
		t.Fatalf("want 3 problems, got %v", err)
	}
	for _, want := range []string{"retention_logs_days must be between 1 and 90", "retention_audit_days must be between 90 and 1825", "HH:MM"} {
		if !strings.Contains(err.Error(), want) {
			t.Errorf("missing %q in %v", want, err)
		}
	}
	got, _ := s.Get(ctx)
	if got != Defaults {
		t.Fatalf("a refused change was applied: %+v", got)
	}
	p, _ := l.List(ctx, audit.Filter{})
	if len(p.Items) != 1 || p.Items[0].Result != "refused" {
		t.Fatalf("want one refused row: %+v", p.Items)
	}
}

func TestEveryRangeMatchesFloorAndCeiling(t *testing.T) {
	ctx := context.Background()
	s, _ := setup(t)
	for key, r := range Ranges {
		for _, v := range []int{r.Min, r.Max} {
			p := patchFor(key, v)
			if _, err := s.Update(ctx, owner, p); err != nil {
				t.Errorf("%s=%d at the limit: %v", key, v, err)
			}
		}
		for _, v := range []int{r.Min - 1, r.Max + 1} {
			if _, err := s.Update(ctx, owner, patchFor(key, v)); err == nil {
				t.Errorf("%s=%d outside the range was accepted", key, v)
			}
		}
	}
}

func patchFor(key string, v int) Patch {
	var p Patch
	switch key {
	case "retention_job_history_days":
		p.RetentionJobHistoryDays = &v
	case "retention_logs_days":
		p.RetentionLogsDays = &v
	case "retention_logs_mib_per_machine":
		p.RetentionLogsMiBPerMachine = &v
	case "retention_audit_days":
		p.RetentionAuditDays = &v
	case "retention_load_raw_hours":
		p.RetentionLoadRawHours = &v
	case "backup_keep_days":
		p.BackupKeepDays = &v
	case "max_event_streams":
		p.MaxEventStreams = &v
	}
	return p
}
