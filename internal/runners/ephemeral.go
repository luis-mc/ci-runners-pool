package runners

import "context"

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
