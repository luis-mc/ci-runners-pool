package auth

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"net/url"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// SessionCookieName is the web session cookie.
const SessionCookieName = "crsp_session"

// SetupCookieName is the first-run cookie.
const SetupCookieName = "crsp_setup"

// SignInStart is what the browser is sent to (R5.8).
type SignInStart struct {
	RedirectURL string
}

// SignInOptions are the inputs of StartSignIn.
type SignInOptions struct {
	// Origin is the console origin the browser used, such as
	// http://127.0.0.1:8460. It picks the callback URL (R5.8).
	Origin string
	// ReturnTo is a same-origin path to land on after sign-in.
	ReturnTo string
	// SetupCookie, when it holds a redeemed setup code and there is no owner,
	// lets this sign-in claim ownership (R5.10).
	SetupCookie string
	// BindTray is a ticket from CreateBindTicket (owner decision for M1).
	BindTray string
}

// SafeReturnTo keeps only a same-origin path (web-console R5.9).
func SafeReturnTo(p string) string {
	if p == "" || !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.HasPrefix(p, "/\\") ||
		strings.ContainsAny(p, "\r\n\\") {
		return "/"
	}
	if u, err := url.Parse(p); err != nil || u.Host != "" || u.Scheme != "" {
		return "/"
	}
	return p
}

// redirectURI is the callback URL of the address the browser used. The
// address must be one the App has a callback URL for, and plain http works
// on loopback only (R5.8, R6.4).
func (s *Service) redirectURI(origin string) (string, error) {
	o, err := NormalizeConsoleURL(origin)
	if err != nil {
		return "", ErrInsecure
	}
	allowed := s.cfg.ConsoleURLs()
	for _, a := range allowed {
		if n, err := NormalizeConsoleURL(a); err == nil && n == o {
			return o + CallbackPath, nil
		}
	}
	return "", errors.New("this address is not one of the console addresses the App was made for")
}

// StartSignIn makes the state and the PKCE challenge, and returns GitHub's
// authorize URL (R5.8). Both are single use and live 10 minutes.
func (s *Service) StartSignIn(ctx context.Context, o SignInOptions) (SignInStart, error) {
	if _, err := s.store.GetApp(ctx); err != nil {
		return SignInStart{}, ErrNoApp
	}
	redirect, err := s.redirectURI(o.Origin)
	if err != nil {
		return SignInStart{}, err
	}
	verifier := RandomToken(32)
	sum := sha256.Sum256([]byte(verifier))
	challenge := base64.RawURLEncoding.EncodeToString(sum[:])

	data := map[string]string{"verifier": verifier, "redirect": redirect, "return_to": SafeReturnTo(o.ReturnTo)}
	if s.CheckSetupCookie(ctx, o.SetupCookie) {
		data["claim_owner"] = "1"
	}
	if o.BindTray != "" {
		if _, ok := s.states.peek("bind", o.BindTray); ok {
			data["bind"] = o.BindTray
		}
	}
	state := s.states.put("signin", StateTTL, data)
	return SignInStart{RedirectURL: s.cfg.GitHub.AuthorizeURL(state, challenge, redirect)}, nil
}

// SignedIn is the result of a good callback.
type SignedIn struct {
	Principal Principal
	// Cookie is the session cookie value; show it once.
	Cookie   string
	ReturnTo string
	// Owner is true when this sign-in made the owner.
	Owner bool
}

// CompleteSignIn finishes the callback: state and PKCE, the GitHub user, the
// allow list, the owner claim, the session (R5.8 to R5.13). origin is the
// address the browser used; an HTTP callback on a non-loopback address is
// refused (R6.4).
func (s *Service) CompleteSignIn(ctx context.Context, code, state, origin string) (SignedIn, error) {
	redirect, err := s.redirectURI(origin)
	if err != nil {
		s.audit(ctx, "anonymous", "auth.signin_failed", "session", "", "address refused", "failed")
		return SignedIn{}, err
	}
	data, ok := s.states.take("signin", state)
	if !ok || data["redirect"] != redirect {
		s.audit(ctx, "anonymous", "auth.signin_failed", "session", "", "bad or old state", "failed")
		return SignedIn{}, ErrBadState
	}
	tok, err := s.cfg.GitHub.ExchangeCode(ctx, code, data["verifier"], redirect)
	if err != nil {
		s.audit(ctx, "anonymous", "auth.signin_failed", "session", "", "code refused", "failed")
		return SignedIn{}, err
	}
	gu, err := s.cfg.GitHub.CurrentUser(ctx, tok)
	if err != nil {
		return SignedIn{}, err
	}
	return s.finishSignIn(ctx, gu, data)
}

func (s *Service) finishSignIn(ctx context.Context, gu github.User, data map[string]string) (SignedIn, error) {
	owner := false
	u, err := s.store.GetUser(ctx, gu.ID)
	switch {
	case err == nil:
	case errors.Is(err, ErrNotFound):
		if data["claim_owner"] != "1" {
			s.audit(ctx, gu.Login, "auth.signin_failed", "session", gu.Login, "not on the list", "failed")
			return SignedIn{}, &NotAllowedError{Login: gu.Login}
		}
		// The first sign-in with a valid setup code becomes the owner. The
		// unique owner rule makes two racing claims safe: one loses.
		nu := User{GitHubID: gu.ID, Login: gu.Login, Role: RoleOwner, AddedBy: "setup", AddedAt: s.cfg.Now()}
		if err := s.store.InsertUser(ctx, nu); err != nil {
			if errors.Is(err, ErrConflict) {
				s.audit(ctx, gu.Login, "auth.signin_failed", "session", gu.Login, "owner already exists", "failed")
				return SignedIn{}, &NotAllowedError{Login: gu.Login}
			}
			return SignedIn{}, err
		}
		u, owner = nu, true
		s.audit(ctx, gu.Login, "auth.owner_claimed", "user", gu.Login, "", "done")
	default:
		return SignedIn{}, err
	}
	// The login is shown and refreshed at each sign-in; identity is the id (R5.9).
	if err := s.store.RecordSignIn(ctx, u.GitHubID, gu.Login, s.cfg.Now()); err != nil {
		return SignedIn{}, err
	}
	u.Login = gu.Login

	cookie, p, err := s.newSession(ctx, u, "web")
	if err != nil {
		return SignedIn{}, err
	}
	if t := data["bind"]; t != "" {
		if b, ok := s.states.take("bind", t); ok {
			_ = s.store.UpsertTrayBinding(ctx, TrayBinding{MachineID: b["machine"], OSUserID: b["os_user"], UserID: u.GitHubID})
			s.auditUser(ctx, p, "auth.tray_bound", "user", u.Login, "")
		}
	}
	s.auditUser(ctx, p, "auth.signin", "session", u.Login, "")
	return SignedIn{Principal: p, Cookie: cookie, ReturnTo: data["return_to"], Owner: owner}, nil
}

// csrfFor derives the CSRF token of a session from its id, so GET /me can
// show it again while the database keeps only a hash.
func csrfFor(sessionID string) string {
	mac := hmac.New(sha256.New, []byte(sessionID))
	mac.Write([]byte("crsp-csrf"))
	return hex.EncodeToString(mac.Sum(nil))
}

// newSession stores a session for u. Sessions never expire by time; they end
// at sign-out, when the user is removed and when their role changes (owner
// decision for M1, which replaces the idle and 7-day limits of R5.13).
func (s *Service) newSession(ctx context.Context, u User, source string) (string, Principal, error) {
	id := RandomToken(32)
	csrf := csrfFor(id)
	if err := s.store.InsertSession(ctx, Session{IDHash: Hash(id), CSRFHash: Hash(csrf), UserID: u.GitHubID, Source: source}); err != nil {
		return "", Principal{}, err
	}
	return id, Principal{UserID: u.GitHubID, Login: u.Login, Role: u.Role, Source: source, SessionHash: Hash(id), CSRF: csrf}, nil
}

// Authenticate turns a session cookie value into a Principal.
func (s *Service) Authenticate(ctx context.Context, cookie string) (Principal, error) {
	if cookie == "" {
		return Principal{}, ErrUnauthenticated
	}
	sess, u, err := s.store.GetSession(ctx, Hash(cookie))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return Principal{}, ErrUnauthenticated
		}
		return Principal{}, err
	}
	_ = s.store.TouchSession(ctx, sess.IDHash, s.cfg.Now())
	return Principal{UserID: u.GitHubID, Login: u.Login, Role: u.Role, Source: sess.Source,
		SessionHash: sess.IDHash, CSRF: csrfFor(cookie)}, nil
}

// CheckCSRF compares the X-CSRF-Token header with the session's token.
func CheckCSRF(p Principal, header string) bool {
	return p.SessionHash != "" && header != "" && equal(p.CSRF, header)
}

// SignOut ends the session of p (R5.13).
func (s *Service) SignOut(ctx context.Context, p Principal) error {
	if p.SessionHash == "" {
		return nil
	}
	if err := s.store.EndSession(ctx, p.SessionHash); err != nil {
		return err
	}
	s.auditUser(ctx, p, "auth.signout", "session", p.Login, "")
	return nil
}

// SessionCookie builds the cookie. It is HttpOnly and SameSite=Lax, and
// Secure on every non-loopback address (R5.13). It has no time limit short of
// the browser's own cap, so a browser restart does not sign anyone out.
func SessionCookie(value string, secure bool) *http.Cookie {
	return &http.Cookie{Name: SessionCookieName, Value: value, Path: "/", HttpOnly: true, Secure: secure,
		SameSite: http.SameSiteLaxMode, MaxAge: 400 * 24 * 3600}
}

// ClearCookie ends the cookie in the browser.
func ClearCookie(name string, secure bool) *http.Cookie {
	return &http.Cookie{Name: name, Value: "", Path: "/", HttpOnly: true, Secure: secure,
		SameSite: http.SameSiteLaxMode, MaxAge: -1}
}

// CookieSecure is true for every address but loopback (R5.13).
func CookieSecure(host string) bool { return !IsLoopbackHost(host) }
