package auth

import (
	"context"
	"errors"
	"strings"
)

// AccessCredentialPrefix starts every access credential value, so the redactor
// and the secret scanners can find one (CRSP134).
const AccessCredentialPrefix = "crsp_acc_"

// ScopeParity is the one access scope: read-only, only what `crsp parity check`
// calls (cli R5.60).
const ScopeParity = "parity"

// ValidScope reports whether s names an access scope.
func ValidScope(s string) bool { return s == ScopeParity }

// CreateAccessCredential makes a credential of a scope. The value comes back
// once; only its hash is kept, and the audit row never holds it. An admin or
// the owner may make one.
func (s *Service) CreateAccessCredential(ctx context.Context, p Principal, name, scope string) (string, AccessCredential, error) {
	if err := Require(p, RoleAdmin); err != nil {
		return "", AccessCredential{}, err
	}
	name = strings.TrimSpace(name)
	if name == "" || len(name) > 80 {
		return "", AccessCredential{}, Invalid("give the credential a name of 1 to 80 characters")
	}
	if !ValidScope(scope) {
		return "", AccessCredential{}, Invalid("the scope must be %q", ScopeParity)
	}
	raw := AccessCredentialPrefix + RandomToken(32)
	c := AccessCredential{ID: "ac_" + RandomToken(6), Hash: Hash(raw), Name: name, Scope: scope,
		CreatedBy: p.Login, CreatedByID: p.UserID, CreatedAt: s.cfg.Now()}
	if err := s.store.InsertAccessCredential(ctx, c); err != nil {
		return "", AccessCredential{}, err
	}
	s.auditUser(ctx, p, "auth.access_made", "access_credential", c.ID, name+" ("+scope+")")
	return raw, c, nil
}

// AuthenticateAccess turns an access credential into a Principal with a scope.
// It has no user id, so no code that asks for a signed-in user accepts it; the
// API allows it only the operations of its scope.
func (s *Service) AuthenticateAccess(ctx context.Context, value string) (Principal, error) {
	if !strings.HasPrefix(value, AccessCredentialPrefix) {
		return Principal{}, ErrUnauthenticated
	}
	c, err := s.store.GetAccessCredential(ctx, Hash(value))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Principal{}, ErrUnauthenticated
		}
		return Principal{}, err
	}
	_ = s.store.TouchAccessCredential(ctx, c.ID, s.cfg.Now())
	return Principal{Login: "access:" + c.Name, Role: RoleViewer, Source: "access", TokenID: c.ID, Scope: c.Scope}, nil
}

// ListAccessCredentials lists every credential, without values.
func (s *Service) ListAccessCredentials(ctx context.Context, p Principal) ([]AccessCredential, error) {
	if err := Require(p, RoleAdmin); err != nil {
		return nil, err
	}
	return s.store.ListAccessCredentials(ctx)
}

// RevokeAccessCredential revokes a credential at once; the next request with
// its value is refused.
func (s *Service) RevokeAccessCredential(ctx context.Context, p Principal, id string) error {
	if err := Require(p, RoleAdmin); err != nil {
		return err
	}
	c, err := s.store.GetAccessCredentialByID(ctx, id)
	if err != nil {
		return err
	}
	if err := s.store.RevokeAccessCredential(ctx, id, s.cfg.Now()); err != nil {
		return err
	}
	s.auditUser(ctx, p, "auth.access_revoked", "access_credential", id, c.Name)
	return nil
}
