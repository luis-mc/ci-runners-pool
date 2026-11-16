package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
)

// Access credentials (CRSP134). The statements are plain SQL on one table; the
// table holds the hash of a value, never the value.

const accessCols = `id, hash, name, scope, created_by_id, created_by_login, created_at, last_used_at, revoked_at`

func scanAccess(row interface{ Scan(...any) error }) (auth.AccessCredential, error) {
	var c auth.AccessCredential
	var created string
	var last, revoked sql.NullString
	if err := row.Scan(&c.ID, &c.Hash, &c.Name, &c.Scope, &c.CreatedByID, &c.CreatedBy, &created, &last, &revoked); err != nil {
		return auth.AccessCredential{}, nf(err)
	}
	c.CreatedAt = ParseTime(created)
	c.LastUsedAt = nullTime(last)
	c.RevokedAt = nullTime(revoked)
	return c, nil
}

func (a *AuthStore) InsertAccessCredential(ctx context.Context, c auth.AccessCredential) error {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	_, err := a.s.db.ExecContext(ctx,
		`INSERT INTO access_credentials (id, hash, name, scope, created_by_id, created_by_login, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Hash, c.Name, c.Scope, c.CreatedByID, c.CreatedBy, fmtTime(c.CreatedAt))
	return err
}

func (a *AuthStore) GetAccessCredential(ctx context.Context, hash string) (auth.AccessCredential, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	return scanAccess(a.s.db.QueryRowContext(ctx,
		`SELECT `+accessCols+` FROM access_credentials WHERE hash = ? AND revoked_at IS NULL`, hash))
}

func (a *AuthStore) TouchAccessCredential(ctx context.Context, id string, at time.Time) error {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	_, err := a.s.db.ExecContext(ctx, `UPDATE access_credentials SET last_used_at = ? WHERE id = ?`, fmtTime(at), id)
	return err
}

func (a *AuthStore) ListAccessCredentials(ctx context.Context) ([]auth.AccessCredential, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	rows, err := a.s.db.QueryContext(ctx, `SELECT `+accessCols+` FROM access_credentials ORDER BY created_at DESC, id`)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	out := []auth.AccessCredential{}
	for rows.Next() {
		c, err := scanAccess(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (a *AuthStore) GetAccessCredentialByID(ctx context.Context, id string) (auth.AccessCredential, error) {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	return scanAccess(a.s.db.QueryRowContext(ctx, `SELECT `+accessCols+` FROM access_credentials WHERE id = ?`, id))
}

func (a *AuthStore) RevokeAccessCredential(ctx context.Context, id string, at time.Time) error {
	ctx, cancel := withDeadline(ctx)
	defer cancel()
	res, err := a.s.db.ExecContext(ctx,
		`UPDATE access_credentials SET revoked_at = COALESCE(revoked_at, ?) WHERE id = ?`, fmtTime(at), id)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return auth.ErrNotFound
	}
	return nil
}
