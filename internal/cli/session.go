package cli

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/client"
	"github.com/luis-mc/ci-runners-shared-pool/internal/cli/contexts"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
	"github.com/luis-mc/ci-runners-shared-pool/internal/tlsca"
)

// The environment variables that sign the CLI in when no login context exists
// (cli R5.60). The names do not end in _KEY, _TOKEN, _SECRET or _PASS, so CI
// logs and secret scanners that key on those endings do not hide them wrongly.
const (
	envURL         = "CRSP_URL"
	envAccess      = "CRSP_ACCESS"
	envFingerprint = "CRSP_CA_FINGERPRINT"
	// envContextName names the in-memory context of an environment sign-in.
	envContextName = "env"
)

// session is a context with its token and a client bound to it.
type session struct {
	ctx    contexts.Context
	token  storedToken
	client *client.ClientWithResponses
	raw    *client.Client
	base   string
}

// storedToken is what the secret store holds for a context. The id is not
// secret; it lets logout revoke the right token.
type storedToken struct {
	Token string `json:"token"`
	ID    string `json:"id"`
}

func tokenKey(name string) secrets.Key { return secrets.Key("crsp/cli/" + name) }

// newPinnedTransport builds an HTTPS transport that accepts only the pinned
// certificate (R5.5, R6.3). There is no flag that turns the check off.
func newPinnedTransport(fingerprint string) *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			// The controller's certificate is its own, not CA-signed. The
			// chain check is replaced by the fingerprint check below.
			InsecureSkipVerify: true, //nolint:gosec // see above
			VerifyPeerCertificate: func(raw [][]byte, _ [][]*x509.Certificate) error {
				if len(raw) == 0 {
					return errors.New("the controller sent no certificate")
				}
				sum := sha256.Sum256(raw[0])
				if !strings.EqualFold(hex.EncodeToString(sum[:]), fingerprint) {
					return errors.New("the controller certificate does not match the pinned fingerprint")
				}
				return nil
			},
		},
	}
}

// newCAPinnedTransport builds an HTTPS transport for an environment sign-in:
// the controller must present a chain that holds the CA with the pinned
// fingerprint (the pin the agents use), or a certificate that is the pin
// itself (the pin `crsp login` makes). There is no flag that turns it off.
func newCAPinnedTransport(fingerprint string) *http.Transport {
	return &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			// The controller's certificate is its own, not CA-signed by a public
			// root. The chain check is replaced by the pin check below.
			InsecureSkipVerify: true, //nolint:gosec // see above
			VerifyPeerCertificate: func(raw [][]byte, _ [][]*x509.Certificate) error {
				if len(raw) == 0 {
					return errors.New("the controller sent no certificate")
				}
				if err := tlsca.VerifyPin(fingerprint, raw, time.Now()); err != nil {
					return errors.New("the controller certificate does not match the pinned fingerprint")
				}
				return nil
			},
		},
	}
}

// envSession signs in from the environment (cli R5.60). It returns ok false
// when none of the three variables is set, so the caller keeps the usual
// "Not signed in" answer; a partial set is an error that names what is missing.
func (c *call) envSession() (s *session, ok bool, err error) {
	url0 := strings.TrimSpace(c.env.Getenv(envURL))
	access := strings.TrimSpace(c.env.Getenv(envAccess))
	fp := normFingerprint(c.env.Getenv(envFingerprint))
	if url0 == "" && access == "" && fp == "" {
		return nil, false, nil
	}
	var missing []string
	if url0 == "" {
		missing = append(missing, envURL)
	}
	if access == "" {
		missing = append(missing, envAccess)
	}
	if len(missing) > 0 {
		return nil, true, fail(ExitAuth, "Not signed in. The environment sign-in needs %s too. Set up parity from the web console (Settings, Access for CI), or run crsp login URL.", strings.Join(missing, " and "))
	}
	u, perr := url.Parse(url0)
	if perr != nil || !controllerSchemeOK(u) {
		return nil, true, fail(ExitUsage, "%s %q must start with https:// (http:// only for 127.0.0.1 or [::1]).", envURL, url0)
	}
	if u.Scheme == "https" && len(fp) != 64 {
		return nil, true, fail(ExitUsage, "%s must be the 64-character SHA-256 fingerprint of the controller's CA certificate. The environment sign-in has no way to skip the check.", envFingerprint)
	}
	sess, err := c.newSessionWith(contexts.Context{Name: envContextName, URL: strings.TrimRight(url0, "/"), Fingerprint: fp},
		storedToken{Token: access}, func() http.RoundTripper { return newCAPinnedTransport(fp) })
	if err != nil {
		return nil, true, err
	}
	return sess, true, nil
}

// open returns the session for this call: context, token and client.
func (c *call) open() (*session, error) {
	if c.cached != nil {
		return c.cached, nil
	}
	cf, err := contexts.Load(c.env.ConfigDir)
	if err != nil {
		return nil, fail(ExitFailed, "Could not read the CLI config: %v", err)
	}
	var ctx contexts.Context
	if c.g.controller != "" {
		found, ok := cf.ByURL(c.g.controller)
		if !ok {
			return nil, fail(ExitUsage, "No context pins %s. Run crsp login %s first.", c.g.controller, c.g.controller)
		}
		ctx = found
	} else {
		ctx, err = cf.Pick(c.g.context, c.env.Getenv("CRSP_CONTEXT"))
		if err != nil {
			if errors.Is(err, contexts.ErrNoContext) {
				// No login context: the environment may sign in (R5.60).
				if es, ok, eerr := c.envSession(); ok {
					if eerr != nil {
						return nil, eerr
					}
					c.cached = es
					return es, nil
				}
				return nil, fail(ExitAuth, "Not signed in. Run crsp login URL, or set %s, %s and %s (from the web console: Settings, Access for CI).", envURL, envAccess, envFingerprint)
			}
			return nil, fail(ExitUsage, "%v. Run crsp context list.", err)
		}
	}
	raw, err := c.env.Secrets.Get(c.env.Context, tokenKey(ctx.Name))
	if errors.Is(err, secrets.ErrNotFound) {
		return nil, fail(ExitAuth, "Not signed in to %s. Run crsp login %s.", ctx.Name, ctx.URL)
	}
	if err != nil {
		return nil, fail(ExitFailed, "Could not read the token from the secret store: %v", err)
	}
	var tok storedToken
	if err := json.Unmarshal(raw, &tok); err != nil || tok.Token == "" {
		return nil, fail(ExitAuth, "The saved token for %s is unreadable. Run crsp login %s.", ctx.Name, ctx.URL)
	}
	s, err := c.newSession(ctx, tok)
	if err != nil {
		return nil, err
	}
	c.cached = s
	return s, nil
}

func (c *call) newSession(ctx contexts.Context, tok storedToken) (*session, error) {
	return c.newSessionWith(ctx, tok, func() http.RoundTripper { return newPinnedTransport(ctx.Fingerprint) })
}

// newSessionWith builds a session with the transport that pin() makes for an
// https address.
func (c *call) newSessionWith(ctx contexts.Context, tok storedToken, pin func() http.RoundTripper) (*session, error) {
	u, err := url.Parse(ctx.URL)
	if err != nil || !controllerSchemeOK(u) {
		return nil, fail(ExitUsage, "The controller address %q must start with https:// (http:// only for 127.0.0.1 or [::1]).", ctx.URL)
	}
	tr := pin()
	if u.Scheme == "http" {
		tr = &http.Transport{Proxy: nil}
	}
	base := strings.TrimRight(ctx.URL, "/")
	edit := func(_ context.Context, req *http.Request) error {
		if tok.Token != "" {
			req.Header.Set("Authorization", "Bearer "+tok.Token)
		}
		return nil
	}
	cl, err := client.NewClientWithResponses(base, client.WithHTTPClient(&http.Client{Transport: tr, Timeout: c.g.timeout}), client.WithRequestEditorFn(edit))
	if err != nil {
		return nil, fail(ExitFailed, "%v", err)
	}
	// The event stream has no overall timeout; it ends with Ctrl+C.
	rc, err := client.NewClient(base, client.WithHTTPClient(&http.Client{Transport: tr}), client.WithRequestEditorFn(edit))
	if err != nil {
		return nil, fail(ExitFailed, "%v", err)
	}
	return &session{ctx: ctx, token: tok, client: cl, raw: rc, base: base}, nil
}

// unreachable maps a transport error to exit 6 (R5.12).
func unreachable(base string, err error) error {
	msg := err.Error()
	if strings.Contains(msg, "pinned fingerprint") {
		return fail(ExitUnreachable, "The certificate of %s does not match the fingerprint pinned at login. It may be another machine. Nothing changed.", base)
	}
	return fail(ExitUnreachable, "Could not reach the controller at %s. %s. Make sure the address is right, then try again.", base, firstLine(msg))
}

func firstLine(s string) string {
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		s = s[:i]
	}
	return strings.TrimRight(s, ". ")
}

// transport maps a transport error to an exitError.
func (s *session) transport(err error) error {
	if errors.Is(err, context.Canceled) {
		return fail(ExitFailed, "Stopped.")
	}
	return unreachable(s.base, err)
}

// apiError turns an error status into an exitError (R5.12, section 7).
func apiError(status int, body []byte) error {
	if status < 400 {
		return nil
	}
	var env client.ErrorEnvelope
	_ = json.Unmarshal(body, &env)
	msg := env.Error.Message
	if msg == "" {
		msg = fmt.Sprintf("The controller answered %d.", status)
	}
	if env.Error.Details != nil {
		for _, d := range *env.Error.Details {
			msg += "\n  " + d.Text
		}
	}
	code := ExitFailed
	switch status {
	case http.StatusUnauthorized, http.StatusForbidden:
		code = ExitAuth
	case http.StatusNotFound:
		code = ExitNotFound
	case http.StatusConflict:
		code = ExitConflict
	}
	return &exitError{Code: code, Message: msg, Envelope: body}
}

func writeEnvelope(w interface{ Write([]byte) (int, error) }, e *exitError) error {
	code := "failed"
	switch e.Code {
	case ExitUsage:
		code = "bad_request"
	case ExitAuth:
		code = "forbidden"
	case ExitNotFound:
		code = "not_found"
	case ExitNotConfirmed:
		code = "needs_confirmation"
	case ExitUnreachable:
		code = "unavailable"
	case ExitConflict:
		code = "conflict"
	}
	b, _ := json.Marshal(client.ErrorEnvelope{Error: client.ErrorBody{Code: code, Message: e.Message}})
	_, err := w.Write(append(b, '\n'))
	return err
}
