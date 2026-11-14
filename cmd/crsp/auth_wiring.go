package main

import (
	"context"
	"errors"
	"log/slog"
	"net/url"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api"
	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
	"github.com/luis-mc/ci-runners-shared-pool/internal/store"
)

// trayMachineID names this machine in tray bindings. The local channel serves
// the controller's own machine only, so one constant is enough (tray R5.9).
const trayMachineID = "controller"

// authLinks makes the one-time sign-in link for the OS user the local channel
// proved (tray R5.6, R5.9). It implements LinkIssuer.
type authLinks struct {
	svc     *auth.Service
	console string
}

// LinkFor answers with the console address to open:
//   - an OS user bound to a console user gets a one-time link for that user;
//   - an unbound OS user gets the GitHub sign-in that binds on success;
//   - a console with no owner yet gets the plain address (the setup wizard).
//
// A person who is not a console user never gets a session: the bind sign-in
// ends at "no access" for a GitHub account the owner has not allowed.
func (l authLinks) LinkFor(ctx context.Context, osUser, target string) (string, error) {
	base, err := url.Parse(l.console)
	if err != nil {
		return "", errors.New("the console address is not valid")
	}
	st, err := l.svc.State(ctx)
	if err != nil {
		return "", errors.New("the console could not read its sign-in state")
	}
	if !st.HasOwner {
		return base.String(), nil
	}
	code, err := l.svc.IssueLinkForOSUser(ctx, trayMachineID, osUser, target)
	switch {
	case err == nil:
		base.Path, base.RawQuery = "/auth/link", url.Values{"code": {code}}.Encode()
		return base.String(), nil
	case errors.Is(err, auth.ErrNotFound):
		q := url.Values{"bind_tray": {l.svc.CreateBindTicket(trayMachineID, osUser)}}
		if rt := auth.SafeReturnTo(target); rt != "/" {
			q.Set("return_to", rt)
		}
		base.Path, base.RawQuery = "/auth/github/login", q.Encode()
		return base.String(), nil
	default:
		return "", errors.New("could not make a sign-in link; sign in with GitHub in the console")
	}
}

// newAuthArea builds the sign-in service on the controller's database and the
// GitHub area of the API. Secrets stay in the OS secret store (github-integration R6.1).
func newAuthArea(db *store.Store, sec secrets.Store, console string, logger *slog.Logger) (*api.GitHubArea, authLinks) {
	gh := github.New(github.Config{Secrets: sec, Logger: logger})
	svc := auth.New(db.Auth(), auth.Config{GitHub: gh, Secrets: sec,
		ConsoleURLs: func() []string { return []string{console} },
		OnApp:       func(a auth.AppRecord) { gh.UseApp(a.ID, a.ClientID) }})
	// After a restart the client must know the App again.
	if a, err := db.Auth().GetApp(context.Background()); err == nil {
		gh.UseApp(a.ID, a.ClientID)
	}
	return &api.GitHubArea{Auth: svc, Logger: logger}, authLinks{svc: svc, console: console}
}
