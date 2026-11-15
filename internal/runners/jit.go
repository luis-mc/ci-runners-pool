package runners

import (
	"context"
	"fmt"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// JobRunner is the request for one runner for one job (runners R5.25).
type JobRunner struct {
	Name      string
	MachineID string
	Arch      string
	Backend   string
	Labels    []string // generic labels only (R5.36)
	Scope     Scope
	// ExtraPackages are the extra packages of the repository's pool (R5.51).
	ExtraPackages []string
}

// StartJobRunner makes one ephemeral runner for one job (runners R5.25,
// github-integration R5.34). It asks GitHub for a JIT config, hands it to the
// agent in the same call and drops it. The config is never in the record, the
// store, the audit trail, an error text or a log: the agent link carries it
// and nothing here keeps a copy. The runner takes one job and exits; the
// agent then calls Stop and CleanUp (R5.26), and a record of an ephemeral
// runner is removed by the caller.
func (s *Service) StartJobRunner(ctx context.Context, j JobRunner, actor string) (Record, error) {
	labels, err := ValidateLabels(j.Labels, s.PoolName, map[string]bool{"docker": true})
	if err != nil {
		return Record{}, err
	}
	j.Labels = labels
	pin, err := PinFor("linux", j.Arch)
	if err != nil {
		return Record{}, err
	}
	t, err := s.Resolver.Resolve(ctx, j.Scope)
	if err != nil {
		return Record{}, fmt.Errorf("resolve scope: %w", err)
	}
	id := s.newID("r_")
	rec := Record{ID: id, Name: j.Name, MachineID: j.MachineID, OS: "linux", Arch: j.Arch, Kind: "ephemeral",
		Backend: j.Backend, Isolation: string(backend.IsolationContainer), Labels: j.Labels, Scope: j.Scope,
		RunnerVersion: pin.Version, State: Creating, Managed: true, CreatedAt: s.now()}
	if err := s.Store.InsertRunner(ctx, rec); err != nil {
		return Record{}, err
	}
	fail := func(err error) (Record, error) {
		_ = s.Store.SetRunnerState(ctx, id, Failed, err.Error())
		s.audit(ctx, actor, "runner.add_failed", j.MachineID, id, err.Error())
		return Record{}, err
	}
	jit, err := s.GitHub.GenerateJITConfig(ctx, t.InstallationID, t.Scope, github.JITRequest{Name: j.Name, GroupID: t.Scope.GroupID, Labels: j.Labels})
	if err != nil {
		return fail(fmt.Errorf("JIT config: %w", err))
	}
	spec := backend.RunnerSpec{ID: id, Name: j.Name, OS: "linux", Arch: j.Arch, Labels: j.Labels, GitHubURL: t.URL, Group: t.Group,
		RunnerVersion: pin.Version, RunnerSHA256: pin.SHA256, CacheQuota: s.CacheQuota, ExtraPackages: j.ExtraPackages}
	if m, err := s.Machines.GetMachine(ctx, j.MachineID); err == nil {
		// The pool size of the machine caps the pool container (R5.27). A
		// machine with no pool size set leaves the container uncapped.
		if m.PoolCPUs > 0 {
			spec.PoolCPUs = float64(m.PoolCPUs)
		}
		if m.PoolMemoryGiB > 0 {
			spec.PoolMemoryMB = int(m.PoolMemoryGiB * 1024)
		}
	}
	h, err := s.Agent.AddRunner(ctx, j.MachineID, spec, backend.StartConfig{JITConfig: jit.Encoded()})
	if err != nil {
		// The agent's error text is its own; the config is not in it by the
		// backend's rule (R6.2), and it is not added here.
		return fail(err)
	}
	if err := s.Store.SetRunnerService(ctx, id, h.Ref, ""); err != nil {
		return Record{}, err
	}
	if err := s.Store.SetRunnerRegistration(ctx, id, jit.RunnerID, pin.Version); err != nil {
		return Record{}, err
	}
	if err := s.Store.SetRunnerState(ctx, id, Idle, "registered with a JIT config"); err != nil {
		return Record{}, err
	}
	s.audit(ctx, actor, "runner.add", j.MachineID, id, j.Name)
	rec.ServiceName, rec.GitHubRunnerID, rec.State = h.Ref, jit.RunnerID, Idle
	return rec, nil
}
