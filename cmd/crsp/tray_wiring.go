package main

import (
	"context"
	"errors"
	"log/slog"
	"net"
	"net/url"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/tray"
	"github.com/luis-mc/ci-runners-shared-pool/internal/trayserver"
	"github.com/luis-mc/ci-runners-shared-pool/internal/update"
	"github.com/luis-mc/ci-runners-shared-pool/internal/webui"
)

// LinkIssuer makes a one-time sign-in link for an OS user of this machine
// (internal/auth Service.IssueLinkForOSUser and CreateBindTicket sit behind it).
// The controller wires it in newAuthArea; a nil value (tests) gives plain addresses.
type LinkIssuer interface {
	LinkFor(ctx context.Context, osUser, target string) (string, error)
}

// trayBackend answers the tray's local channel from the update manager, the
// machines drain and the console address (tray R5.8, R5.29).
type trayBackend struct {
	Updates *update.Manager
	Drain   machineDrainer
	Console string // http(s)://host:port of the console
	Links   LinkIssuer
}

func (b trayBackend) response(ctx context.Context, st update.Status) tray.Response {
	on := st.AutoUpdate
	return tray.Response{
		State: tray.StateHealthy, Running: len(st.RunningJobs), Version: st.Current, AutoUpdate: &on,
		LatestVersion: st.Latest, UpdateAvailable: st.Available, UpdateState: string(st.State),
		LogDir: tray.LogDir(),
		Policy: b.policy(ctx),
	}
}

// policy is this machine's mode and acceptance; nil before the machine joined.
func (b trayBackend) policy(ctx context.Context) *tray.PolicyInfo {
	v, ok := b.Drain.policy(ctx)
	if !ok {
		return nil
	}
	p := &tray.PolicyInfo{
		Mode: v.Settings.EffectiveMode(), Accepting: v.Policy.Accepting, PauseReason: v.Policy.PauseReason, OnBattery: v.Policy.OnBattery,
		UntilResumed: v.Settings.PausedUntilResumed,
	}
	if !v.Settings.PauseUntil.IsZero() && v.Settings.PauseUntil.After(time.Now()) {
		p.PauseUntilMs = v.Settings.PauseUntil.UnixMilli()
	}
	return p
}

func trayActor(c trayserver.Caller) string { return "tray:" + c.OSUser }

// SetMode sets this machine's mode (tray R5.31).
func (b trayBackend) SetMode(ctx context.Context, c trayserver.Caller, mode string) (tray.Response, error) {
	if err := b.Drain.setPolicy(ctx, trayActor(c), machines.SettingsUpdate{Mode: &mode}); err != nil {
		return tray.Response{}, err
	}
	return b.Status(ctx)
}

// Pause pauses new jobs for one hour or until Resume (tray R5.31).
func (b trayBackend) Pause(ctx context.Context, c trayserver.Caller, kind string) (tray.Response, error) {
	if kind != machines.PauseOneHour && kind != machines.PauseUntilResumedValue {
		return tray.Response{}, errors.New("a pause is one_hour or until_resumed")
	}
	if err := b.Drain.setPolicy(ctx, trayActor(c), machines.SettingsUpdate{Pause: &kind}); err != nil {
		return tray.Response{}, err
	}
	return b.Status(ctx)
}

// Resume ends a pause from the tray and, when the mode is Paused, returns it to
// Automatic (tray R5.31).
func (b trayBackend) Resume(ctx context.Context, c trayserver.Caller) (tray.Response, error) {
	none := machines.PauseNone
	u := machines.SettingsUpdate{Pause: &none}
	if v, ok := b.Drain.policy(ctx); ok && v.Settings.EffectiveMode() == machines.ModePaused {
		auto := machines.ModeAutomatic
		u.Mode = &auto
	}
	if err := b.Drain.setPolicy(ctx, trayActor(c), u); err != nil {
		return tray.Response{}, err
	}
	return b.Status(ctx)
}

func (b trayBackend) Status(ctx context.Context) (tray.Response, error) {
	return b.response(ctx, b.Updates.Status(ctx)), nil
}

func (b trayBackend) Check(ctx context.Context) (tray.Response, error) {
	st, err := b.Updates.Check(ctx)
	if err != nil {
		return tray.Response{}, err
	}
	return b.response(ctx, st), nil
}

// Link returns a one-time sign-in link when sign-in is wired. Until it is, the
// console has no sign-in, so the link is the console address on the target
// path; it carries no secret and signs nobody in.
func (b trayBackend) Link(ctx context.Context, c trayserver.Caller, target string) (string, error) {
	if b.Links != nil {
		return b.Links.LinkFor(ctx, c.OSUser, target)
	}
	u, err := url.Parse(b.Console)
	if err != nil {
		return "", errors.New("the console address is not valid")
	}
	if p := target; len(p) > 0 && p[0] == '/' && (len(p) == 1 || p[1] != '/') {
		u.Path = p
	}
	return u.String(), nil
}

// consoleURL turns the listen address into the address a browser on this machine uses.
func consoleURL(listen string) string {
	host, port, err := net.SplitHostPort(listen)
	if err != nil || host == "" || host == "0.0.0.0" || host == "::" || host == "[::]" {
		host = "127.0.0.1"
	}
	if port == "" {
		port = "8460"
	}
	return consoleScheme(host) + "://" + net.JoinHostPort(host, port)
}

// consoleScheme is http on 127.0.0.1 and ::1 and https on every other address
// (web-console R5.1).
func consoleScheme(host string) string {
	if webui.IsLoopback(host) {
		return "http"
	}
	return "https"
}

// startTrayChannel serves the local channel until ctx ends. A failure to open
// it is logged and does not stop the controller: the tray then shows its
// stopped state and the console works as before.
func startTrayChannel(ctx context.Context, logger *slog.Logger, b trayBackend) {
	ln, err := trayserver.Listen(trayserver.DefaultPath(), logger)
	if err != nil {
		logger.Warn("tray channel is off", "err", err)
		return
	}
	go func() {
		if err := (&trayserver.Server{Backend: b, Logger: logger.With("component", "tray-channel")}).Serve(ctx, ln); err != nil {
			logger.Warn("tray channel stopped", "err", err)
		}
	}()
}
