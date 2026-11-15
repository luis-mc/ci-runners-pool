package runners

import (
	"context"
	"errors"
	"fmt"
)

// EphemeralOnMachine counts the ephemeral runners of a machine that still
// hold a slot: every state except failed. The demand loop uses it to keep
// within the slot budget of the machine (scheduling R5.1, runners R5.27).
func (s *Service) EphemeralOnMachine(ctx context.Context, machineID string) (int, error) {
	rs, err := s.Store.ListRunners(ctx, Filter{MachineID: machineID})
	if err != nil {
		return 0, err
	}
	n := 0
	for _, r := range rs {
		if r.Kind == "ephemeral" && r.State != Failed {
			n++
		}
	}
	return n, nil
}

// FinishJobRunner cleans up the runner of a job that ended: the agent removes
// the job folder and its files, then the record goes (runners R5.25, R5.26).
// GitHub drops an ephemeral runner by itself after its one job.
func (s *Service) FinishJobRunner(ctx context.Context, runnerID, actor string) error {
	r, err := s.Store.GetRunner(ctx, runnerID)
	if err != nil {
		return err
	}
	if r.Kind != "ephemeral" {
		return refuse("runner %s is not ephemeral", r.Name)
	}
	if err := s.Agent.CleanUp(ctx, r.MachineID, r.ServiceName); err != nil {
		return err
	}
	if err := s.Store.DeleteRunner(ctx, r.ID); err != nil {
		return err
	}
	s.audit(ctx, actor, "runner.job_done", r.MachineID, r.ID, r.Name)
	return nil
}

// ErrRunnerBusy means GitHub says the runner has a job, so it is not removed.
var ErrRunnerBusy = errors.New("the runner has a job")

// RemoveIdleRunner removes an ephemeral runner that never got a job and frees
// its slot (runners R5.26). It asks GitHub first (the busy check): a busy
// runner is left alone and ErrRunnerBusy is returned. Then it deletes the
// runner at GitHub (GitHub refuses a runner that took a job in the meantime),
// stops the listener, cleans up the job folder and drops the record.
func (s *Service) RemoveIdleRunner(ctx context.Context, runnerID, actor string) error {
	r, err := s.Store.GetRunner(ctx, runnerID)
	if err != nil {
		return err
	}
	if r.Kind != "ephemeral" {
		return refuse("runner %s is not ephemeral", r.Name)
	}
	t, err := s.Resolver.Resolve(ctx, r.Scope)
	if err != nil {
		return err
	}
	list, err := s.GitHub.ListRunners(ctx, t.InstallationID, t.Scope)
	if err != nil {
		return err // fail closed: an unreadable list removes nothing
	}
	for _, g := range list {
		if g.Name != r.Name {
			continue
		}
		if g.Busy {
			return ErrRunnerBusy
		}
		if err := s.GitHub.DeleteRunner(ctx, t.InstallationID, t.Scope, g.ID); err != nil {
			return fmt.Errorf("remove the idle runner at GitHub: %w", err)
		}
		break
	}
	// The listener may already be gone; the clean-up below is what counts.
	stopErr := s.Agent.StopService(ctx, r.MachineID, r.ServiceName)
	if err := s.Agent.CleanUp(ctx, r.MachineID, r.ServiceName); err != nil {
		return err
	}
	if err := s.Store.DeleteRunner(ctx, r.ID); err != nil {
		return err
	}
	detail := r.Name
	if stopErr != nil {
		detail += " (stop: " + stopErr.Error() + ")"
	}
	s.audit(ctx, actor, "runner.idle_removed", r.MachineID, r.ID, detail)
	return nil
}
