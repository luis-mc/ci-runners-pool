package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"path/filepath"
	"sync/atomic"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/config"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/settings"
	"github.com/luis-mc/ci-runners-shared-pool/internal/update"
)

// idleHook lets the machines service call the update manager, which is built
// after it. The machines service runs OnIdle when a drain has finished.
type idleHook struct {
	fn atomic.Pointer[func(context.Context, machines.Change) error]
}

func (h *idleHook) call(ctx context.Context, c machines.Change) error {
	if f := h.fn.Load(); f != nil {
		return (*f)(ctx, c)
	}
	return nil
}

// machineDrainer drains the controller's own machine through the machines
// service: no new jobs, running jobs finish, then OnIdle (tray R5.17). It never
// stops a job.
type machineDrainer struct{ svc *machines.Service }

func (d machineDrainer) local(ctx context.Context) (machines.View, error) {
	vs, err := d.svc.List(ctx)
	if err != nil {
		return machines.View{}, err
	}
	for _, v := range vs {
		if v.Machine.IsController {
			return v, nil
		}
	}
	return machines.View{}, errors.New("this machine has not joined the pool yet, so it cannot drain")
}

func (d machineDrainer) RunningJobs(ctx context.Context) ([]update.Job, error) {
	v, err := d.local(ctx)
	if err != nil {
		return nil, nil // no machine yet means no job to wait for
	}
	out := make([]update.Job, 0, len(v.RunningJobs))
	for _, j := range v.RunningJobs {
		out = append(out, update.Job{Repository: j.Repository, RunID: j.RunID, Job: j.Job})
	}
	return out, nil
}

func (d machineDrainer) BeginDrain(ctx context.Context, kind update.Kind, actor string) error {
	v, err := d.local(ctx)
	if err != nil {
		return err
	}
	k, reason := machines.KindAgentUpdate, "update to a newer release"
	if kind == update.KindRestart {
		k, reason = machines.KindServiceRestart, "restart the service"
	}
	_, err = d.svc.StartChange(ctx, actor, v.Machine.ID, k, reason)
	return err
}

func (d machineDrainer) DrainTimeoutMinutes(ctx context.Context) int {
	if v, err := d.local(ctx); err == nil {
		return v.Settings.DrainTimeoutMinutes
	}
	return machines.DefaultSettings().DrainTimeoutMinutes
}

// startUpdates builds the update manager, binds it to the machines drain and
// starts the 6-hourly check (operations R5.11).
func startUpdates(ctx context.Context, cfg config.Config, logger *slog.Logger, mr *machinesRuntime, set *settings.Service, idle *idleHook) *update.Manager {
	exe, err := update.ExecutablePath()
	if err != nil {
		logger.Warn("self-update: cannot find the running binary", "err", err)
	}
	host, port, err := net.SplitHostPort(cfg.ListenAddr)
	if err != nil || host == "" || host == "0.0.0.0" || host == "::" || host == "[::]" {
		host = "127.0.0.1"
	}
	if port == "" {
		port = "8460"
	}
	m := update.New(update.Options{
		Current:  version,
		Source:   update.GitHubSource{},
		Attester: update.GHAttester{},
		Drainer:  machineDrainer{svc: mr.Service},
		AutoUpdate: func(ctx context.Context) bool {
			if set == nil {
				return settings.Defaults.AutoUpdate
			}
			s, err := set.Get(ctx)
			return err != nil || s.AutoUpdate
		},
		Dir:       filepath.Join(cfg.DataDir, "updates"),
		HealthURL: fmt.Sprintf("http://%s/healthz", net.JoinHostPort(host, port)),
		Exe:       exe,
		Logger:    logger.With("component", "update"),
	})
	fn := func(ctx context.Context, c machines.Change) error {
		switch c.Kind {
		case machines.KindAgentUpdate:
			return m.OnIdle(ctx, update.KindUpdate)
		case machines.KindServiceRestart:
			return m.OnIdle(ctx, update.KindRestart)
		}
		return nil
	}
	idle.fn.Store(&fn)
	go m.Run(ctx, time.Minute, 6*time.Hour)
	return m
}
