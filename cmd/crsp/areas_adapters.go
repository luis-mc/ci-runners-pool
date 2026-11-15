package main

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/repos"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
)

// machineCapacity says which OSes some active machine serves, with the labels
// its machines carry (github-integration R5.28).
type machineCapacity struct {
	svc  *machines.Service
	pool string
}

func (c machineCapacity) OSLabels(ctx context.Context) (map[string][]string, error) {
	views, err := c.svc.List(ctx)
	if err != nil {
		return nil, err
	}
	out := map[string][]string{}
	for _, v := range views {
		m := v.Machine
		if !m.RemovedAt.IsZero() || m.State == "removed" {
			continue
		}
		os := runners.OSName(m.OS)
		if os == "" {
			continue
		}
		have := map[string]bool{}
		for _, l := range out[os] {
			have[strings.ToLower(l)] = true
		}
		for _, l := range []string{archLabel(m.Arch), c.pool} {
			if l != "" && !have[strings.ToLower(l)] {
				out[os] = append(out[os], l)
				have[strings.ToLower(l)] = true
			}
		}
		if _, ok := out[os]; !ok {
			out[os] = nil
		}
	}
	return out, nil
}

func archLabel(arch string) string {
	switch arch {
	case "x64":
		return "X64"
	case "arm64":
		return "ARM64"
	}
	return ""
}

// machineLookup gives the runners service the machine facts.
type machineLookup struct{ svc *machines.Service }

func (l machineLookup) GetMachine(ctx context.Context, id string) (runners.Machine, error) {
	v, err := l.svc.Get(ctx, id)
	if err != nil {
		if errors.Is(err, machines.ErrNotFound) {
			return runners.Machine{}, runners.ErrNotFound
		}
		return runners.Machine{}, err
	}
	m := runners.Machine{ID: v.Machine.ID, Name: v.Machine.Name, OS: v.Machine.OS, Arch: v.Machine.Arch,
		PoolCPUs: v.Settings.PoolCPUs, PoolMemoryGiB: v.Settings.PoolMemoryGiB, JobSlots: v.Settings.JobSlots}
	for _, b := range v.Backends {
		kinds := []string{"ephemeral"}
		if b.Name == string(backend.Persistent) {
			kinds = []string{"persistent"}
		}
		m.Backends = append(m.Backends, runners.BackendOption{
			Name: backend.Name(b.Name), Usable: b.Present && b.Usable, Allowed: b.Allowed,
			Reason: b.Reason, Kinds: kinds, OS: []string{v.Machine.OS},
		})
	}
	return m, nil
}

// scopeResolver turns a runner scope into the installation and address GitHub calls need.
type scopeResolver struct {
	repos repos.Store
	auth  *auth.Service
}

func (r scopeResolver) Resolve(ctx context.Context, s runners.Scope) (runners.Target, error) {
	switch s.Kind {
	case "repository":
		repo, err := r.repos.GetRepository(ctx, s.RepositoryID)
		if err != nil {
			return runners.Target{}, fmt.Errorf("repository %d: %w", s.RepositoryID, err)
		}
		return runners.Target{
			Scope:          github.RunnerScope{Owner: repo.Owner, Repo: repo.Name},
			InstallationID: repo.InstallationID, URL: "https://github.com/" + repo.FullName, Group: s.Group,
		}, nil
	case "organization":
		ins, err := r.repos.ListInstallations(ctx)
		if err != nil {
			return runners.Target{}, err
		}
		for _, i := range ins {
			if strings.EqualFold(i.AccountLogin, s.Organization) && !i.Removed {
				return runners.Target{
					Scope:          github.RunnerScope{Owner: i.AccountLogin, Organization: i.AccountLogin},
					InstallationID: i.ID, URL: "https://github.com/" + i.AccountLogin, Group: s.Group,
				}, nil
			}
		}
		return runners.Target{}, fmt.Errorf("the GitHub App is not installed on %s", s.Organization)
	}
	return runners.Target{}, fmt.Errorf("unknown runner scope %q", s.Kind)
}

// linkAgent reaches a machine's agent. The controller's own machine runs the
// backend of this OS directly; any other machine gets the runner messages of
// the agent link (agent.proto AddRunner, StopRunner, RemoveRunner; CRSP63).
type linkAgent struct {
	local  *runners.LocalAgent
	svc    *machines.Service
	remote runners.Agent // the agent link; nil when the link is not wired
}

var errRemoteRunners = errors.New("this machine is not the controller's own and the agent link is not wired")

func (a linkAgent) forMachine(ctx context.Context, id string) (runners.Agent, error) {
	v, err := a.svc.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	if v.Machine.IsController {
		return a.local, nil
	}
	if a.remote == nil {
		return nil, errRemoteRunners
	}
	return a.remote, nil
}

func (a linkAgent) AddRunner(ctx context.Context, id string, spec backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error) {
	l, err := a.forMachine(ctx, id)
	if err != nil {
		return backend.Handle{}, err
	}
	return l.AddRunner(ctx, id, spec, cfg)
}

func (a linkAgent) StopService(ctx context.Context, id, service string) error {
	l, err := a.forMachine(ctx, id)
	if err != nil {
		return err
	}
	return l.StopService(ctx, id, service)
}

func (a linkAgent) RemoveRunner(ctx context.Context, id string, req runners.RemoveRequest) error {
	l, err := a.forMachine(ctx, id)
	if err != nil {
		return err
	}
	return l.RemoveRunner(ctx, id, req)
}

func (a linkAgent) CleanUp(ctx context.Context, id, service string) error {
	l, err := a.forMachine(ctx, id)
	if err != nil {
		return err
	}
	return l.CleanUp(ctx, id, service)
}

// runnerAudit writes the audit entry of every add, remove and replace.
type runnerAudit struct{ auth *auth.Service }

func (r runnerAudit) Audit(ctx context.Context, actor, action, machineID, subject, detail string) {
	if machineID != "" {
		detail = strings.TrimSpace("machine " + machineID + " " + detail)
	}
	r.auth.Audit(ctx, auth.Principal{Login: actor, Source: "web"}, action, "runner", subject, detail)
}

// doctorFleet is the controller's own data, as the doctor checks read it.
type doctorFleet struct {
	machines *machines.Service
	runners  runners.Store
	repos    repos.Store
	rsvc     *repos.Service
}

func (f doctorFleet) Machines(ctx context.Context) ([]doctor.Machine, error) {
	views, err := f.machines.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]doctor.Machine, 0, len(views))
	for _, v := range views {
		m := doctor.Machine{
			ID: v.Machine.ID, Name: v.Machine.Name, OS: v.Machine.OS, Online: v.Machine.Online,
			LastSeen: v.Machine.LastSeen, State: v.Settings.State,
			BudgetMemoryPct: v.Settings.BudgetMemoryPct, BudgetCPUPct: v.Settings.BudgetCPUPct,
			LightSlots: v.Settings.LightSlots,
		}
		if m.State == "" {
			m.State = v.Machine.State
		}
		if v.Load != nil {
			m.Load = &doctor.Load{MemoryPct: v.Load.MemoryPct, CPUPct: v.Load.CPUPct,
				MemoryKnown: v.Load.MemoryKnown, CPUKnown: v.Load.CPUKnown, SampledAt: v.Load.SampledAt}
		}
		if free, total := v.Machine.Facts.DiskFreeBytes, v.Machine.Facts.DiskTotalBytes; total > 0 {
			m.DiskFreeBytes, m.DiskTotalBytes = &free, &total
		}
		out = append(out, m)
	}
	return out, nil
}

func (f doctorFleet) Runners(ctx context.Context) ([]doctor.Runner, error) {
	managed := true
	rs, err := f.runners.ListRunners(ctx, runners.Filter{Managed: &managed})
	if err != nil {
		return nil, err
	}
	names := map[string]string{}
	if views, err := f.machines.List(ctx); err == nil {
		for _, v := range views {
			names[v.Machine.ID] = v.Machine.Name
		}
	}
	out := make([]doctor.Runner, 0, len(rs))
	for _, r := range rs {
		dr := doctor.Runner{
			ID: r.ID, Name: r.Name, MachineID: r.MachineID, MachineName: names[r.MachineID], OS: r.OS, Kind: r.Kind,
			Labels: r.Labels, GitHubRunnerID: r.GitHubRunnerID, ServiceName: r.ServiceName, FolderReadable: true,
		}
		if r.Scope.Kind == "repository" {
			if repo, err := f.repos.GetRepository(ctx, r.Scope.RepositoryID); err == nil {
				dr.InstallationID = repo.InstallationID
				dr.Scope = github.RunnerScope{Owner: repo.Owner, Repo: repo.Name}
			}
		} else if r.Scope.Organization != "" {
			dr.Scope = github.RunnerScope{Owner: r.Scope.Organization, Organization: r.Scope.Organization}
		}
		out = append(out, dr)
	}
	return out, nil
}

// Services needs a machine's agent to list its OS services; the agent link does
// not carry that yet, so the checks that need it skip (doctor R5.5).
func (f doctorFleet) Services(context.Context, string) ([]doctor.OSService, error) {
	return nil, doctor.ErrUnreachable
}

func (f doctorFleet) Repositories(ctx context.Context) ([]doctor.Repository, error) {
	on := true
	rs, err := f.repos.ListRepositories(ctx, repos.ListFilter{Pool: &on})
	if err != nil {
		return nil, err
	}
	out := make([]doctor.Repository, 0, len(rs))
	for _, r := range rs {
		pol, _ := f.repos.GetPolicy(ctx, r.ID)
		want, err := f.rsvc.Desired(ctx, pol)
		if err != nil {
			want = nil
		}
		out = append(out, doctor.Repository{ID: r.ID, FullName: r.FullName, Owner: r.Owner, Name: r.Name,
			InstallationID: r.InstallationID, DefaultBranch: r.DefaultBranch, Expected: want, LightRunner: pol.LightRunner})
	}
	return out, nil
}

// lightPlacer lists the machines that can host a light runner: online, active,
// of the OS, with light slots above 0. Only the controller's own machine can
// add runners until the runner messages of the agent link are built, so only
// it is listed (scheduling R5.65).
type lightPlacer struct{ svc *machines.Service }

func (p lightPlacer) LightHosts(ctx context.Context, os string) ([]runners.LightHost, error) {
	views, err := p.svc.List(ctx)
	if err != nil {
		return nil, err
	}
	var out []runners.LightHost
	for _, v := range views {
		m := v.Machine
		state := v.Settings.State
		if state == "" {
			state = m.State
		}
		if !m.RemovedAt.IsZero() || !m.Online || !m.IsController || m.OS != os ||
			(state != "" && state != machines.StateActive) || v.Settings.LightSlots < 1 {
			continue
		}
		out = append(out, runners.LightHost{MachineID: m.ID, LightSlots: v.Settings.LightSlots})
	}
	return out, nil
}

// lightKeeper gives the repositories service the light runners of the runners service.
type lightKeeper struct{ svc *runners.Service }

func (k lightKeeper) EnsureLight(ctx context.Context, r repos.Repository, oses []string, actor string) (int, []string, error) {
	res, err := k.svc.EnsureLight(ctx, r.ID, r.Name, oses, actor)
	have := 0
	var notes []string
	for _, x := range res {
		if x.Runner != "" {
			have++
		} else if x.Why != "" {
			notes = append(notes, runners.OSName(x.OS)+": "+x.Why)
		}
	}
	return have, notes, err
}

func (k lightKeeper) RemoveLight(ctx context.Context, r repos.Repository, actor string) error {
	_, err := k.svc.RemoveLight(ctx, r.ID, actor)
	return err
}
