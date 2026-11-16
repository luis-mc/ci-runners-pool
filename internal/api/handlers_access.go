package api

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"net/http"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
)

func toAccessCredential(c auth.AccessCredential) gen.AccessCredential {
	out := gen.AccessCredential{Id: c.ID, Name: c.Name, Scope: gen.AccessScope(c.Scope), CreatedBy: c.CreatedBy, CreatedAt: c.CreatedAt}
	if !c.LastUsedAt.IsZero() {
		t := c.LastUsedAt
		out.LastUsedAt = &t
	}
	if !c.RevokedAt.IsZero() {
		t := c.RevokedAt
		out.RevokedAt = &t
	}
	return out
}

// ListAccessCredentials implements GET /api/v1/access-credentials (R5.82).
func (s *server) ListAccessCredentials(ctx context.Context, _ gen.ListAccessCredentialsRequestObject) (gen.ListAccessCredentialsResponseObject, error) {
	cs, err := s.ghArea().Auth.ListAccessCredentials(ctx, s.principal(ctx))
	if err != nil {
		code, body := failure(err)
		return gen.ListAccessCredentialsdefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	items := make([]gen.AccessCredential, 0, len(cs))
	for _, c := range cs {
		items = append(items, toAccessCredential(c))
	}
	return gen.ListAccessCredentials200JSONResponse{Items: items}, nil
}

// CreateAccessCredential implements POST /api/v1/access-credentials (R5.82).
// The value is in the answer once and nowhere else.
func (s *server) CreateAccessCredential(ctx context.Context, req gen.CreateAccessCredentialRequestObject) (gen.CreateAccessCredentialResponseObject, error) {
	fail := func(err error) (gen.CreateAccessCredentialResponseObject, error) {
		code, body := failure(err)
		return gen.CreateAccessCredentialdefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	if req.Body == nil {
		return fail(auth.Invalid("send a name and a scope"))
	}
	value, info, err := s.ghArea().Auth.CreateAccessCredential(ctx, s.principal(ctx), req.Body.Name, string(req.Body.Scope))
	if err != nil {
		return fail(err)
	}
	return gen.CreateAccessCredential201JSONResponse{Value: value, Info: toAccessCredential(info)}, nil
}

// RevokeAccessCredential implements DELETE /api/v1/access-credentials/{credentialId}.
func (s *server) RevokeAccessCredential(ctx context.Context, req gen.RevokeAccessCredentialRequestObject) (gen.RevokeAccessCredentialResponseObject, error) {
	if err := s.ghArea().Auth.RevokeAccessCredential(ctx, s.principal(ctx), req.CredentialId); err != nil {
		code, body := failure(err)
		return gen.RevokeAccessCredentialdefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	return gen.RevokeAccessCredential204Response{}, nil
}

// caFingerprint is the SHA-256 of the CA certificate the controller serves,
// as lower-case hex: the value `crsp` pins in CRSP_CA_FINGERPRINT.
func caFingerprint(ca CAProvider) string {
	if ca == nil {
		return ""
	}
	blk, _ := pem.Decode(ca.CAPEM())
	if blk == nil {
		return ""
	}
	sum := sha256.Sum256(blk.Bytes)
	return hex.EncodeToString(sum[:])
}

// SetupRepositoryParity implements POST /api/v1/repositories/{repositoryId}/parity-setup
// (R5.84). The credential value goes from the auth service to GitHub (sealed)
// and is not in the answer.
func (s *server) SetupRepositoryParity(ctx context.Context, req gen.SetupRepositoryParityRequestObject) (gen.SetupRepositoryParityResponseObject, error) {
	fail := func(err error) (gen.SetupRepositoryParityResponseObject, error) {
		code, body := failure(err)
		return gen.SetupRepositoryParitydefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	a, p := s.ghArea(), s.principal(ctx)
	st, err := a.Auth.State(ctx)
	if err != nil || !st.HasApp {
		return fail(auth.ErrNoApp)
	}
	addr := ""
	if req.Body != nil && req.Body.ControllerUrl != nil {
		addr = strings.TrimRight(strings.TrimSpace(*req.Body.ControllerUrl), "/")
	}
	if addr == "" {
		if r := requestFrom(ctx); r != nil {
			addr = origin(r)
		}
	}
	if !strings.HasPrefix(addr, "https://") && !strings.HasPrefix(addr, "http://") {
		return fail(auth.Invalid("the controller address must start with https://"))
	}
	repo, err := a.Repos.Get(ctx, p, req.RepositoryId)
	if err != nil {
		return fail(err)
	}
	res, err := a.Repos.SetupParity(ctx, p, req.RepositoryId, repos.ParityInput{
		ControllerURL: addr, CAFingerprint: caFingerprint(s.opts.CA),
		Issue: func(ctx context.Context) (string, string, error) {
			v, c, err := a.Auth.CreateAccessCredential(ctx, p, "parity: "+repo.FullName, auth.ScopeParity)
			return v, c.ID, err
		},
		Revoke: func(ctx context.Context, id string) error { return a.Auth.RevokeAccessCredential(ctx, p, id) },
	})
	if err != nil {
		if errors.Is(err, repos.ErrParityUnavailable) {
			return gen.SetupRepositoryParitydefaultJSONResponse{StatusCode: http.StatusNotImplemented, Body: notImplemented()}, nil
		}
		return fail(err)
	}
	if !res.Done {
		m := res.MissingPermissions
		g := grantBody(res.Grant)
		return gen.SetupRepositoryParity200JSONResponse{Status: gen.ParitySetupStatusNeedsPermission, MissingPermissions: &m, Grant: &g}, nil
	}
	return gen.SetupRepositoryParity200JSONResponse{Status: gen.ParitySetupStatusDone, AccessName: &res.SecretName,
		VariableNames: &res.VariableNames, AccessId: &res.CredentialID}, nil
}

// grantBody maps the service's grant view to the API shape.
func grantBody(v repos.GrantView) gen.GithubGrant {
	steps := make([]gen.GithubGrantStep, 0, len(v.Steps))
	for _, st := range v.Steps {
		perms := st.Permissions
		if perms == nil {
			perms = []string{}
		}
		step := gen.GithubGrantStep{Id: gen.GithubGrantStepId(st.ID), Done: st.Done, Permissions: perms}
		if st.URL != "" {
			u := st.URL
			step.Url = &u
		}
		steps = append(steps, step)
	}
	missing := v.Missing
	if missing == nil {
		missing = []string{}
	}
	out := gen.GithubGrant{Ready: v.Ready, Steps: steps, Missing: missing}
	if v.Next != "" {
		n := gen.GithubGrantNext(v.Next)
		out.Next = &n
	}
	if v.InstallationID != 0 {
		id := v.InstallationID
		out.InstallationId = &id
	}
	return out
}

// GetGithubGrant implements GET /api/v1/github/grant (R5.89).
func (s *server) GetGithubGrant(ctx context.Context, req gen.GetGithubGrantRequestObject) (gen.GetGithubGrantResponseObject, error) {
	fail := func(err error) (gen.GetGithubGrantResponseObject, error) {
		code, body := failure(err)
		return gen.GetGithubGrantdefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	var needs []string
	list := ""
	if req.Params.Permissions != nil {
		list = *req.Params.Permissions
	}
	for _, n := range strings.Split(list, ",") {
		if n = strings.TrimSpace(n); n != "" {
			needs = append(needs, n)
		}
	}
	if len(needs) == 0 {
		return fail(auth.Invalid("name at least one permission"))
	}
	in := repos.GrantInput{Needs: needs}
	if req.Params.InstallationId != nil {
		in.InstallationID = *req.Params.InstallationId
	}
	if req.Params.RepositoryId != nil {
		in.RepositoryID = *req.Params.RepositoryId
	}
	v, err := s.ghArea().Repos.Grant(ctx, s.principal(ctx), in)
	if err != nil {
		return fail(err)
	}
	return gen.GetGithubGrant200JSONResponse(grantBody(v)), nil
}
