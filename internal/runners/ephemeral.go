package runners

import (
	"context"
	"errors"
	"fmt"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
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
// its slot (runners R5.26). It is the safe removal of R5.62: see removeSafely.
func (s *Service) RemoveIdleRunner(ctx context.Context, runnerID, actor string) error {
	r, err := s.Store.GetRunner(ctx, runnerID)
	if err != nil {
		return err
	}
	if r.Kind != "ephemeral" {
		return refuse("runner %s is not ephemeral", r.Name)
	}
	return s.removeSafely(ctx, r, actor, "runner.idle_removed")
}

// removeSafely is the one order every removal of a runner follows (runners
// R5.62): ask GitHub whether the runner is idle, deregister it at GitHub, and
// only then stop the listener and clean up. GitHub therefore never lists a
// runner with nothing behind it, and a busy runner is never touched.
//
//   - A busy runner, or a delete GitHub refuses with 422 because a job came
//     in between, returns ErrRunnerBusy and changes nothing.
//   - A runner GitHub does not know (not listed, or a 404 on delete) counts
//     as already deregistered, and the local clean-up goes on.
//   - An unreadable runner list changes nothing (fail closed).
//
// Each outcome is logged to the audit trail with the runner name.
func (s *Service) removeSafely(ctx context.Context, r Record, actor, action string) error {
	t, err := s.Resolver.Resolve(ctx, r.Scope)
	if err != nil {
		return err
	}
	list, err := s.GitHub.ListRunners(ctx, t.InstallationID, t.Scope)
	if err != nil {
		return err // fail closed: an unreadable list removes nothing
	}
	known := false
	for _, g := range list {
		if g.Name != r.Name {
			continue
		}
		if g.Busy {
			s.audit(ctx, actor, "runner.remove_left_busy", r.MachineID, r.ID, r.Name)
			return ErrRunnerBusy
		}
		known = true
		err := s.GitHub.DeleteRunner(ctx, t.InstallationID, t.Scope, g.ID)
		switch {
		case errors.Is(err, github.ErrRunnerBusy):
			s.audit(ctx, actor, "runner.remove_left_busy", r.MachineID, r.ID, r.Name+" (GitHub answered 422)")
			return ErrRunnerBusy
		case errors.Is(err, github.ErrNotFound):
			known = false // gone between the list and the delete
		case err != nil:
			return fmt.Errorf("remove the runner at GitHub: %w", err)
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
	if !known {
		detail += " (GitHub no longer knew it)"
	}
	if stopErr != nil {
		detail += " (stop: " + stopErr.Error() + ")"
	}
	s.audit(ctx, actor, action, r.MachineID, r.ID, detail)
	return nil
}
