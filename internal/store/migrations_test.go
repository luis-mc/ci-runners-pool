package store

import (
	"context"
	"io/fs"
	"strings"
	"testing"

	"github.com/pressly/goose/v3"

	"github.com/luis-mc/ci-runners-shared-pool/internal/store/sqlcgen"
)

// TestIntegrationMigrationsDownAndUp proves every migration's Down undoes its
// Up: all the way down to zero, then up again, on a real SQLite file.
func TestIntegrationMigrationsDownAndUp(t *testing.T) {
	s := openTemp(t)
	ctx := context.Background()
	sub, err := fs.Sub(migrationsFS, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	p, err := goose.NewProvider(goose.DialectSQLite3, s.db, sub)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := p.DownTo(ctx, 0); err != nil {
		t.Fatalf("down: %v", err)
	}
	if _, err := p.Up(ctx); err != nil {
		t.Fatalf("up again: %v", err)
	}
	v, err := p.GetDBVersion(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if v < 8 {
		t.Fatalf("schema version %d, want at least 8", v)
	}
}

// TestIntegrationAuditLogIsAppendOnly checks observability R5.26: no row of
// the audit log can be edited.
func TestIntegrationAuditLogIsAppendOnly(t *testing.T) {
	s := openTemp(t)
	ctx := context.Background()
	if err := s.WithTx(ctx, func(tx *Tx) error {
		_, err := tx.Audit("system", "test", "", "{}")
		return err
	}); err != nil {
		t.Fatal(err)
	}
	_, err := s.db.ExecContext(ctx, `UPDATE audit_log SET action = 'changed'`)
	if err == nil || !strings.Contains(err.Error(), "append-only") {
		t.Fatalf("update of audit_log: err = %v, want append-only refusal", err)
	}
}

// TestIntegrationEveryQueryPrepares checks every sqlc query against the
// migrated schema of a real SQLite file, so a query that names a missing
// table or column fails here, not in a feature branch.
func TestIntegrationEveryQueryPrepares(t *testing.T) {
	s := openTemp(t)
	q, err := sqlcgen.Prepare(context.Background(), s.db)
	if err != nil {
		t.Fatal(err)
	}
	if err := q.Close(); err != nil {
		t.Fatal(err)
	}
}
