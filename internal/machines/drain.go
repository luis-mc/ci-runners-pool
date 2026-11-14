package machines

import (
	"context"
	"fmt"
	"sort"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

func jobNames(jobs []JobRef) []string {
	out := make([]string, 0, len(jobs))
	for _, j := range jobs {
		out = append(out, fmt.Sprintf("%s, run %d, job %s, runner %s, started %s",
			j.Repository, j.RunID, j.Job, j.RunnerName, j.StartedAt.Local().Format("15:04")))
	}
	return out
}

func (s *Service) runningJobs(id string) []JobRef {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]JobRef(nil), s.running[id]...)
}

// SetRunning records the jobs the machine runs now, from Hello and from drain
// status, so a drain can name what it waits for (R5.30).
func (s *Service) SetRunning(machineID string, jobs []JobRef, runners []string) {
	s.mu.Lock()
	s.running[machineID] = jobs
	if runners != nil {
		s.runners[machineID] = runners
	}
	s.mu.Unlock()
}

// beginChange stores a change that waits for a drain, puts the machine into
// draining and asks the agent to drain (R5.30, R5.31).
func (s *Service) beginChange(ctx context.Context, actor string, m Machine, kind string, d ChangeDetail, timeoutMinutes int) (Change, error) {
	now := s.now()
	if timeoutMinutes <= 0 {
		timeoutMinutes = DefaultSettings().DrainTimeoutMinutes
	}
	d.WaitingFor = s.runningJobs(m.ID)
	c := Change{
		ID: newID("ch_"), MachineID: m.ID, Kind: kind, State: ChangeWaiting, Detail: d,
		StartedBy: actor, StartedAt: now, Deadline: now.Add(time.Duration(timeoutMinutes) * time.Minute),
	}
	if err := s.o.Repo.InsertChange(ctx, c); err != nil {
		return Change{}, err
	}
	m.State = StateDraining
	if err := s.o.Repo.UpdateMachine(ctx, m); err != nil {
		return Change{}, err
	}
	_ = s.o.Repo.Audit(ctx, actor, "machine."+kind, m.ID, d.Reason)
	s.sendDrain(c, timeoutMinutes)
	s.notifyMachine(m.ID)
	return c, nil
}

func (s *Service) sendDrain(c Change, timeoutMinutes int) {
	_ = s.sessions.send(c.MachineID, &agentv1.SessionResponse{Message: &agentv1.SessionResponse_Drain{Drain: &agentv1.Drain{
		CommandId: c.ID, ChangeKind: c.Kind, TimeoutSeconds: int32(timeoutMinutes * 60), //nolint:gosec // 5 minutes to 24 hours
	}}})
}

// Drain stops new jobs on the machine; running jobs finish (R5.30). Nothing is
// ever stopped.
func (s *Service) Drain(ctx context.Context, actor, id, reason string) (Change, error) {
	m, err := s.o.Repo.GetMachine(ctx, id)
	if err != nil {
		return Change{}, err
	}
	if !m.RemovedAt.IsZero() {
		return Change{}, ErrNotFound
	}
	if _, open, err := s.o.Repo.OpenChange(ctx, id); err != nil {
		return Change{}, err
	} else if open {
		return Change{}, fmt.Errorf("%w: a change is already waiting on this machine", ErrConflict)
	}
	if m.State == StateDrained {
		return Change{}, fmt.Errorf("%w: the machine is already drained", ErrConflict)
	}
	set, err := s.o.Repo.GetSettings(ctx, id)
	if err != nil {
		return Change{}, err
	}
	return s.beginChange(ctx, actor, m, KindDrain, ChangeDetail{Reason: reason}, set.DrainTimeoutMinutes)
}

// StartChange begins a change of another feature that restarts runners or the
// agent: it drains first and then calls Options.OnIdle (R5.31).
func (s *Service) StartChange(ctx context.Context, actor, id, kind, reason string) (Change, error) {
	switch kind {
	case KindAgentUpdate, KindRunnerUpdate, KindServiceRestart:
	default:
		return Change{}, fmt.Errorf("%w: unknown change kind %q", ErrInvalid, kind)
	}
	m, err := s.o.Repo.GetMachine(ctx, id)
	if err != nil {
		return Change{}, err
	}
	if _, open, err := s.o.Repo.OpenChange(ctx, id); err != nil {
		return Change{}, err
	} else if open {
		return Change{}, fmt.Errorf("%w: a change is already waiting on this machine", ErrConflict)
	}
	set, err := s.o.Repo.GetSettings(ctx, id)
	if err != nil {
		return Change{}, err
	}
	return s.beginChange(ctx, actor, m, kind, ChangeDetail{Reason: reason}, set.DrainTimeoutMinutes)
}

// Resume returns a drained machine to active (R5.34). A change that is still
// waiting is cancelled first, and that needs a yes.
func (s *Service) Resume(ctx context.Context, actor, id string, confirm bool) (View, error) {
	m, err := s.o.Repo.GetMachine(ctx, id)
	if err != nil {
		return View{}, err
	}
	if !m.RemovedAt.IsZero() {
		return View{}, ErrNotFound
	}
	if c, open, err := s.o.Repo.OpenChange(ctx, id); err != nil {
		return View{}, err
	} else if open {
		if !confirm {
			return View{}, &NeedsConfirmationError{
				Message: fmt.Sprintf("a %s change is waiting and will be cancelled", c.Kind),
				Names:   append([]string{"the waiting " + c.Kind + " change"}, jobNames(c.Detail.WaitingFor)...),
			}
		}
		c.State, c.FinishedAt = ChangeCancel, s.now()
		if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
			return View{}, err
		}
		_ = s.o.Repo.Audit(ctx, actor, "machine.change.cancel", id, c.Kind)
	}
	s.setActive(ctx, id, m, actor)
	return s.Get(ctx, id)
}

func (s *Service) setActive(ctx context.Context, id string, m Machine, actor string) {
	m.State = StateActive
	_ = s.o.Repo.UpdateMachine(ctx, m)
	_ = s.o.Repo.Audit(ctx, actor, "machine.resume", id, "")
	_ = s.sessions.send(id, &agentv1.SessionResponse{Message: &agentv1.SessionResponse_Resume{Resume: &agentv1.Resume{CommandId: newID("cmd_")}}})
	s.notifyMachine(id)
}

// Remove names what goes and, with a yes, drains the machine, revokes its key
// and closes its link (R5.40 to R5.42). An offline machine cannot drain: its key
// is revoked at once and its runners are deregistered; its local files stay
// until it is uninstalled (R5.42).
func (s *Service) Remove(ctx context.Context, actor, id string, confirm bool) (Change, error) {
	m, err := s.o.Repo.GetMachine(ctx, id)
	if err != nil {
		return Change{}, err
	}
	if !m.RemovedAt.IsZero() {
		return Change{}, ErrNotFound
	}
	if !confirm {
		s.mu.Lock()
		runners := append([]string(nil), s.runners[id]...)
		s.mu.Unlock()
		names := []string{"the machine " + m.Name}
		for _, r := range runners {
			names = append(names, "runner "+r+" (deregistered from GitHub)")
		}
		names = append(names, "its images and caches", "its settings", "its key (revoked at once)")
		names = append(names, jobNames(s.runningJobs(id))...)
		return Change{}, &NeedsConfirmationError{Message: "removing " + m.Name + " drains it first, then removes everything below", Names: names}
	}
	if _, open, err := s.o.Repo.OpenChange(ctx, id); err != nil {
		return Change{}, err
	} else if open {
		return Change{}, fmt.Errorf("%w: a change is already waiting on this machine", ErrConflict)
	}
	if !s.sessions.Connected(id) {
		now := s.now()
		c := Change{
			ID: newID("ch_"), MachineID: id, Kind: KindRemove, State: ChangeDone, StartedBy: actor, StartedAt: now, Deadline: now, FinishedAt: now,
			Detail: ChangeDetail{Reason: "the machine is offline: its key is revoked now and its agent learns this on its next connect; its local files stay until it is uninstalled"},
		}
		if err := s.o.Repo.InsertChange(ctx, c); err != nil {
			return Change{}, err
		}
		s.finishRemove(ctx, actor, m)
		return c, nil
	}
	set, err := s.o.Repo.GetSettings(ctx, id)
	if err != nil {
		return Change{}, err
	}
	return s.beginChange(ctx, actor, m, KindRemove, ChangeDetail{Reason: "remove machine"}, set.DrainTimeoutMinutes)
}

// finishRemove revokes the key at once and closes the link (R5.41, R6.4).
func (s *Service) finishRemove(ctx context.Context, actor string, m Machine) {
	_ = s.o.Repo.RevokeKeys(ctx, m.ID)
	_ = s.o.Repo.MarkRemoved(ctx, m.ID, s.now())
	_ = s.o.Repo.Audit(ctx, actor, "machine.key.revoke", m.ID, "")
	_ = s.o.Repo.Audit(ctx, actor, "machine.remove", m.ID, "name "+m.Name)
	_ = s.sessions.send(m.ID, &agentv1.SessionResponse{Message: &agentv1.SessionResponse_MachineRemoved{MachineRemoved: &agentv1.MachineRemoved{Reason: "this machine was removed from the pool"}}})
	s.sessions.kickAfterFlush(m.ID)
	s.mu.Lock()
	delete(s.loads, m.ID)
	delete(s.running, m.ID)
	delete(s.runners, m.ID)
	s.mu.Unlock()
	s.notifyMachine(m.ID)
}

// GetChange returns a change of a machine.
func (s *Service) GetChange(ctx context.Context, machineID, id string) (Change, error) {
	return s.o.Repo.GetChange(ctx, machineID, id)
}

// Decision is the user's answer to a change that needs them (R5.33).
type Decision string

// Decisions.
const (
	WaitLonger Decision = "wait_longer"
	CancelIt   Decision = "cancel"
	StopJobs   Decision = "stop_jobs"
)

// DecideChange answers a change that timed out: wait longer, cancel it, or
// stop the named jobs (which needs a yes).
func (s *Service) DecideChange(ctx context.Context, actor, machineID, changeID string, d Decision, waitMinutes int, confirm bool) (Change, error) {
	c, err := s.o.Repo.GetChange(ctx, machineID, changeID)
	if err != nil {
		return Change{}, err
	}
	if c.State != ChangeNeedsYou && c.State != ChangeWaiting {
		return Change{}, fmt.Errorf("%w: this change is %s", ErrConflict, c.State)
	}
	m, err := s.o.Repo.GetMachine(ctx, machineID)
	if err != nil {
		return Change{}, err
	}
	switch d {
	case WaitLonger:
		if waitMinutes < 5 || waitMinutes > 1440 {
			return Change{}, fmt.Errorf("%w: wait 5 minutes to 24 hours", ErrInvalid)
		}
		c.State, c.Deadline = ChangeWaiting, s.now().Add(time.Duration(waitMinutes)*time.Minute)
		if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
			return Change{}, err
		}
		_ = s.o.Repo.Audit(ctx, actor, "machine.change.wait_longer", machineID, fmt.Sprintf("%d minutes", waitMinutes))
		s.sendDrain(c, waitMinutes)
	case CancelIt:
		c.State, c.FinishedAt = ChangeCancel, s.now()
		if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
			return Change{}, err
		}
		_ = s.o.Repo.Audit(ctx, actor, "machine.change.cancel", machineID, c.Kind)
		s.setActive(ctx, machineID, m, actor)
	case StopJobs:
		jobs := s.runningJobs(machineID)
		if !confirm {
			return Change{}, &NeedsConfirmationError{Message: "these jobs will be stopped now", Names: jobNames(jobs)}
		}
		if s.o.Stopper == nil {
			return Change{}, fmt.Errorf("%w: stopping jobs needs the runners feature, which is not part of this build", ErrNotSupported)
		}
		if err := s.o.Stopper.StopJobs(ctx, machineID, jobs); err != nil {
			return Change{}, err
		}
		_ = s.o.Repo.Audit(ctx, actor, "machine.change.stop_jobs", machineID, fmt.Sprintf("%d jobs", len(jobs)))
		c.State = ChangeWaiting
		c.Deadline = s.now().Add(5 * time.Minute)
		if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
			return Change{}, err
		}
	default:
		return Change{}, fmt.Errorf("%w: unknown decision %q", ErrInvalid, d)
	}
	s.notifyMachine(machineID)
	return c, nil
}

// HandleDrainStatus takes the agent's report of what a drain waits for. When
// the agent says it is idle, the change runs. The agent's idle answer is the
// check taken right before the restart, in the step that keeps new jobs out, so
// a job that started since the drain began makes the agent say not idle again
// (R5.32). An idle check taken earlier never counts: only a report for this
// change's command id from the connected agent does.
func (s *Service) HandleDrainStatus(ctx context.Context, machineID string, st *agentv1.DrainStatus) error {
	c, err := s.o.Repo.GetChange(ctx, machineID, st.GetCommandId())
	if err != nil {
		return nil // an old command; nothing to do
	}
	if c.State != ChangeWaiting && c.State != ChangeNeedsYou {
		return nil
	}
	var jobs []JobRef
	for _, j := range st.GetWaitingFor() {
		jobs = append(jobs, jobFromProto(j))
	}
	sort.Slice(jobs, func(i, j int) bool { return jobs[i].StartedAt.Before(jobs[j].StartedAt) })
	c.Detail.WaitingFor = jobs
	if !st.GetIdle() {
		return s.o.Repo.UpdateChange(ctx, c)
	}
	return s.execute(ctx, c)
}

func (s *Service) execute(ctx context.Context, c Change) error {
	m, err := s.o.Repo.GetMachine(ctx, c.MachineID)
	if err != nil {
		return err
	}
	c.State = ChangeRunning
	if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
		return err
	}
	finish := func() error {
		c.State, c.FinishedAt = ChangeDone, s.now()
		return s.o.Repo.UpdateChange(ctx, c)
	}
	switch c.Kind {
	case KindDrain:
		m.State = StateDrained
		if err := s.o.Repo.UpdateMachine(ctx, m); err != nil {
			return err
		}
		_ = s.o.Repo.Audit(ctx, c.StartedBy, "machine.drained", m.ID, "")
		s.pushSettings(m.ID, mustSettings(s.o.Repo.GetSettings(ctx, m.ID)))
	case KindSettings:
		cur, err := s.o.Repo.GetSettings(ctx, m.ID)
		if err != nil {
			return err
		}
		if c.Detail.Settings != nil {
			next := *c.Detail.Settings
			next.Version = cur.Version + 1
			if err := s.o.Repo.PutSettings(ctx, m.ID, next); err != nil {
				return err
			}
			_ = s.o.Repo.Audit(ctx, c.StartedBy, "machine.settings", m.ID, settingsDiff(cur, next))
		}
		s.setActive(ctx, m.ID, m, c.StartedBy)
		s.pushSettings(m.ID, mustSettings(s.o.Repo.GetSettings(ctx, m.ID)))
	case KindRemove:
		if err := finishOr(finish); err != nil {
			return err
		}
		s.finishRemove(ctx, c.StartedBy, m)
		return nil
	default:
		if s.o.OnIdle != nil {
			if err := s.o.OnIdle(ctx, c); err != nil {
				c.State = ChangeNeedsYou
				c.Detail.Reason = "the change could not run: " + err.Error()
				_ = s.o.Repo.UpdateChange(ctx, c)
				return err
			}
		}
		s.setActive(ctx, m.ID, m, c.StartedBy)
	}
	s.notifyMachine(m.ID)
	return finish()
}

func finishOr(f func() error) error { return f() }

func mustSettings(st Settings, _ error) Settings { return st }

func jobFromProto(j *agentv1.JobRef) JobRef {
	return JobRef{Repository: j.GetRepository(), RunID: j.GetRunId(), RunAttempt: int(j.GetRunAttempt()), Job: j.GetJob(), GitHubJobID: j.GetGithubJobId(), RunnerName: j.GetRunnerName()}
}
