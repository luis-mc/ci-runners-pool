package main

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/demand"
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
		pol, err := e.repos.GetPolicy(ctx, r.ID)
		if err != nil {
			return demand.Repo{}, false, err
		}
		return demand.Repo{Scope: runners.Scope{Kind: "repository", RepositoryID: r.ID}, AllowFork: pol.AllowForkPRs}, true, nil
	}
	return demand.Repo{}, false, nil
}

// Hosts lists the machines that may start container runners (runners R5.9,
// R5.27): the controller's own machine only, until the runner messages of the
// agent link are built; online, active, Linux; the container backend present,
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
		if !m.RemovedAt.IsZero() || !m.Online || !m.IsController || m.OS != "linux" ||
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

// startDemand runs the poller and the demand loop until the returned stop is
// called. Nothing is polled while no machine can start a container runner, so
// a controller whose allow list is empty spends no GitHub quota on it.
func startDemand(ctx context.Context, logger *slog.Logger, gh *github.REST, env demandEnv, svc *runners.Service, pool string) (stop func()) {
	ctx, cancel := context.WithCancel(ctx)
	loop := &demand.Loop{Env: env, Runners: svc, PoolName: pool, Logger: logger}
	poller := &github.Poller{
		Client:   gh,
		Interval: demandPollEvery,
		Targets: func(ctx context.Context) ([]github.PollTarget, error) {
			if gh.AppID() == 0 {
				return nil, nil
			}
			hosts, err := env.Hosts(ctx)
			if err != nil || len(hosts) == 0 {
				return nil, err
			}
			on := true
			rs, err := env.repos.ListRepositories(ctx, repos.ListFilter{Pool: &on})
			if err != nil {
				return nil, err
			}
			out := make([]github.PollTarget, 0, len(rs))
			for _, r := range rs {
				out = append(out, github.PollTarget{InstallationID: r.InstallationID, Owner: r.Owner, Repo: r.Name})
			}
			return out, nil
		},
		OnError: func(err error) {
			if ctx.Err() == nil {
				logger.Warn("poll queued jobs", "err", err)
			}
		},
	}
	jobs, err := poller.Jobs(ctx)
	if err != nil {
		logger.Error("start the demand poller", "err", err)
		cancel()
		return func() {}
	}
	done := make(chan struct{})
	go func() {
		defer close(done)
		loop.Run(ctx, jobs)
	}()
	return func() { cancel(); <-done }
}
