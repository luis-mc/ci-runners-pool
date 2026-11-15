package main

import (
	"context"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/demand"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
)

// demandPollEvery is the base interval of the REST demand poller
// (github-integration R5.37). It backs off to five minutes while nothing changes.
const demandPollEvery = 15 * time.Second

// machineSource is the machines service as the demand loop reads it.
type machineSource interface {
	List(ctx context.Context) ([]machines.View, error)
}

// demandEnv tells the demand loop which repositories have the pool on and which
// machines may start container runners.
type demandEnv struct {
	repos    repos.Store
	machines machineSource
}

var _ demand.Env = demandEnv{}

// Repo returns the repository when its pool is on.
func (e demandEnv) Repo(ctx context.Context, fullName string) (demand.Repo, bool, error) {
	on := true
	rs, err := e.repos.ListRepositories(ctx, repos.ListFilter{Pool: &on, Query: fullName})
	if err != nil {
		return demand.Repo{}, false, err
	}
	for _, r := range rs {
		if !strings.EqualFold(r.FullName, fullName) {
			continue
		}
		if r.Visibility == "public" {
			return demand.Repo{}, false, nil // crsp never serves a public repository (CRSP82)
		}
		pol, err := e.repos.GetPolicy(ctx, r.ID)
		if err != nil {
			return demand.Repo{}, false, err
		}
		return demand.Repo{InstallationID: r.InstallationID, Scope: runners.Scope{Kind: "repository", RepositoryID: r.ID}, AllowFork: pol.AllowForkPRs, ExtraPackages: pol.ExtraPackages}, true, nil
	}
	return demand.Repo{}, false, nil
}

// Hosts lists the machines that may start container runners (runners R5.9,
// R5.27): the controller's own machine, or another machine whose agent is
// connected over the agent link (CRSP63); online, active, Linux; the container backend present,
// usable and in the machine's allow list, which is off by default; and a job
// slot budget above zero (the pool size of CRSP50).
func (e demandEnv) Hosts(ctx context.Context) ([]demand.Host, error) {
	views, err := e.machines.List(ctx)
	if err != nil {
		return nil, err
	}
	var out []demand.Host
	for _, v := range views {
		m := v.Machine
		state := v.Settings.State
		if state == "" {
			state = m.State
		}
		if !m.RemovedAt.IsZero() || !m.Online || m.OS != "linux" ||
			(state != "" && state != machines.StateActive) || v.Settings.JobSlots < 1 {
			continue
		}
		if m.Arch != "x64" && m.Arch != "arm64" {
			continue
		}
		for _, b := range v.Backends {
			if b.Name == string(backend.Docker) && b.Allowed && b.Present && b.Usable {
				out = append(out, demand.Host{MachineID: m.ID, Arch: m.Arch, Slots: v.Settings.JobSlots})
				break
			}
		}
	}
	return out, nil
}

// demandRunner runs the poller and the demand loop, and can restart both once
// (the quiet-demand watchdog, github-integration R5.37). The loop keeps its
// state across a restart, so no second runner starts for a job it already
// served.
type demandRunner struct {
	logger *slog.Logger
	gh     *github.REST
	env    demandEnv
	loop   *demand.Loop

	// scaleSet turns on the scale-set source with polling as the fallback
	// (github-integration R5.40).
	scaleSet bool

	mu     sync.Mutex
	ctx    context.Context
	poller *github.Poller
	scale  *github.ScaleSetDemand
	// onQueued feeds webhook health (RES14); nil does nothing.
	onQueued func(string, int64)
	cancel   context.CancelFunc
	done     chan struct{}
}

// targets lists the repositories to poll. Nothing is polled while no machine
// can start a container runner, so a controller whose allow list is empty
// spends no GitHub quota on it.
func (d *demandRunner) targets(ctx context.Context) ([]github.PollTarget, error) {
	if d.gh.AppID() == 0 {
		return nil, nil
	}
	hosts, err := d.env.Hosts(ctx)
	if err != nil || len(hosts) == 0 {
		return nil, err
	}
	on := true
	rs, err := d.env.repos.ListRepositories(ctx, repos.ListFilter{Pool: &on})
	if err != nil {
		return nil, err
	}
	out := make([]github.PollTarget, 0, len(rs))
	for _, r := range rs {
		out = append(out, github.PollTarget{InstallationID: r.InstallationID, Owner: r.Owner, Repo: r.Name})
	}
	return out, nil
}

// start makes a new poller and runs it with the loop.
func (d *demandRunner) start() {
	ctx, cancel := context.WithCancel(d.ctx)
	poller := &github.Poller{
		Client:   d.gh,
		Interval: demandPollEvery,
		Targets:  d.targets,
		OnQueued: d.onQueued,
		OnError: func(err error) {
			if ctx.Err() == nil {
				d.logger.Warn("poll queued jobs", "err", err)
			}
		},
	}
	var src github.Demand = poller
	d.scale = nil
	if d.scaleSet {
		scale := &github.ScaleSetDemand{Tokens: d.gh, Name: d.loop.PoolName, APIBase: d.gh.APIBase(), WebBase: d.gh.WebBase(),
			Targets: func(ctx context.Context) ([]github.ScaleSetTarget, error) {
				ts, err := d.targets(ctx)
				out := make([]github.ScaleSetTarget, 0, len(ts))
				for _, t := range ts {
					out = append(out, github.ScaleSetTarget(t))
				}
				return out, err
			}}
		d.scale = scale
		d.loop.ScaleJIT = func(j github.Job, name string) func(context.Context) (github.JITConfig, error) {
			return func(ctx context.Context) (github.JITConfig, error) { return scale.JIT(ctx, j, name) }
		}
		src = &demand.Failover{Primary: scale, Fallback: poller, Logger: d.logger, Why: scale.Err,
			OnState: func(source, why string) { d.logger.Info("demand source", "source", source, "why", why) }}
		d.logger.Info("scale-set demand is on; polling is the fallback", "scale_set", d.loop.PoolName)
	}
	jobs, err := src.Jobs(ctx)
	if err != nil {
		d.logger.Error("start the demand source", "err", err)
		cancel()
		return
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		d.loop.Run(ctx, jobs)
	}()
	d.poller, d.cancel, d.done = poller, cancel, done
}

func (d *demandRunner) stopCurrent() {
	if d.cancel != nil {
		d.cancel()
		<-d.done
		d.cancel, d.done = nil, nil
	}
}

// Restart stops the poller and the loop and starts them again.
func (d *demandRunner) Restart() {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.ctx.Err() != nil {
		return
	}
	d.stopCurrent()
	d.start()
}

// LastDemand implements demand.DemandSeen over the current poller.
func (d *demandRunner) LastDemand(fullName string) time.Time {
	d.mu.Lock()
	p, sc := d.poller, d.scale
	d.mu.Unlock()
	var t time.Time
	if p != nil {
		t = p.LastDemand(fullName)
	}
	if sc != nil {
		if s := sc.LastDemand(fullName); s.After(t) {
			t = s
		}
	}
	return t
}

// Stop ends the poller and the loop.
func (d *demandRunner) Stop() {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.stopCurrent()
}

// startDemand runs the poller, the demand loop and the quiet-demand watchdog
// until the returned stop is called. The watchdog's state is what the doctor
// check `demand.quiet` reads.
func startDemand(ctx context.Context, logger *slog.Logger, gh *github.REST, env demandEnv, svc *runners.Service, pool string, quiet time.Duration, scaleSet bool, onQueued func(string, int64)) (stop func(), wd *demand.Watchdog) {
	ctx, cancel := context.WithCancel(ctx)
	dr := &demandRunner{logger: logger, gh: gh, env: env, ctx: ctx, scaleSet: scaleSet, onQueued: onQueued,
		loop: &demand.Loop{Env: env, Runners: svc, PoolName: pool, Logger: logger, ReadJob: gh.GetJob}}
	dr.mu.Lock()
	dr.start()
	dr.mu.Unlock()
	wd = &demand.Watchdog{Lister: gh, Targets: dr.targets, Source: dr, Restart: dr.Restart,
		PoolName: pool, Quiet: quiet, Logger: logger}
	wdDone := make(chan struct{})
	go func() {
		defer close(wdDone)
		wd.Run(ctx, time.Minute)
	}()
	return func() { cancel(); <-wdDone; dr.Stop() }, wd
}

// quietSource gives the doctor what the quiet-demand watchdog found.
type quietSource struct{ wd *demand.Watchdog }

var _ doctor.DemandSource = quietSource{}

// QuietDemand implements doctor.DemandSource.
func (q quietSource) QuietDemand(context.Context) ([]doctor.QuietDemand, error) {
	var out []doctor.QuietDemand
	for _, r := range q.wd.QuietRepos() {
		out = append(out, doctor.QuietDemand{Repository: r.Repository, Queued: r.Queued, Since: r.Since,
			Restarted: r.Restarted, RestartedAt: r.RestartedAt})
	}
	return out, nil
}
