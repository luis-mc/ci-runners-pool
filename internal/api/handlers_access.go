package api

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

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
	return fingerprintOf(ca.CAPEM())
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
	// The address is the controller's own, the one machines join at: never the
	// address of the browser, which may be loopback or http (CRSP141).
	addr, err := repos.ParityAddress(s.opts.PublicHost, s.opts.ListenAddr)
	if err != nil {
		var ae *repos.AddressError
		if errors.As(err, &ae) {
			return gen.SetupRepositoryParity200JSONResponse{Status: gen.ParitySetupStatusNeedsAddress,
				AddressProblem: &ae.Reason, AddressSetting: &ae.Setting}, nil
		}
		return fail(err)
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

// GetParityAddress implements GET /api/v1/parity-address (github-integration
// R5.84, CRSP141): the address the setup will write, and whether the
// controller reaches it from the server side.
func (s *server) GetParityAddress(ctx context.Context, _ gen.GetParityAddressRequestObject) (gen.GetParityAddressResponseObject, error) {
	addr, err := repos.ParityAddress(s.opts.PublicHost, s.opts.ListenAddr)
	if err != nil {
		var ae *repos.AddressError
		if errors.As(err, &ae) {
			return gen.GetParityAddress200JSONResponse{Status: gen.ParityAddressStatusNeedsAddress, Problem: &ae.Reason, Setting: &ae.Setting}, nil
		}
		code, body := failure(err)
		return gen.GetParityAddressdefaultJSONResponse{StatusCode: code, Body: body}, nil
	}
	probe := s.opts.ParityProbe
	if probe == nil {
		probe = func(ctx context.Context, addr string) error { return probeController(ctx, addr, s.opts.CA) }
	}
	if err := probe(ctx, addr); err != nil {
		msg := "the controller did not answer at " + addr + ": " + err.Error()
		return gen.GetParityAddress200JSONResponse{Status: gen.ParityAddressStatusUnreachable, Url: &addr, Problem: &msg}, nil
	}
	return gen.GetParityAddress200JSONResponse{Status: gen.ParityAddressStatusOk, Url: &addr}, nil
}

// probeTimeout bounds the check: a runner that waits longer than this for the
// controller has a problem the owner should hear about.
const probeTimeout = 5 * time.Second

// probeController calls addr from the server side the way a runner will: over
// https, trusting only the controller CA, and asks for the CA certificate. It
// answers nil only when the answer is this controller's own CA.
func probeController(ctx context.Context, addr string, ca CAProvider) error {
	if ca == nil {
		return errors.New("this controller has no certificate authority")
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(ca.CAPEM()) {
		return errors.New("the controller certificate authority could not be read")
	}
	ctx, cancel := context.WithTimeout(ctx, probeTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(addr, "/")+"/api/v1/ca.pem", nil)
	if err != nil {
		return err
	}
	client := &http.Client{
		Transport: &http.Transport{TLSClientConfig: &tls.Config{RootCAs: pool, MinVersion: tls.VersionTLS13}},
		// An address that redirects is not the controller's own.
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
	defer client.CloseIdleConnections()
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer func() { _ = res.Body.Close() }()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("it answered with status %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return err
	}
	if fingerprintOf(body) != caFingerprint(ca) {
		return errors.New("it answered with another certificate authority")
	}
	return nil
}

func fingerprintOf(pemBytes []byte) string {
	blk, _ := pem.Decode(pemBytes)
	if blk == nil {
		return ""
	}
	sum := sha256.Sum256(blk.Bytes)
	return hex.EncodeToString(sum[:])
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

// GetGithubGrant implements GET /api/v1/github/grant (R5.86).
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
