package machines

import (
	"context"
	"fmt"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

// Cap states the agent reports for the CPU cap (R5.62).
const (
	CapApplied      = "applied"
	CapNotSupported = "not_supported"
	CapFailed       = "failed"
)

// Policy is what a machine last reported about taking new jobs (R5.60) and
// the battery and CPU cap facts the console shows next to it.
type Policy struct {
	Accepting    bool
	PauseReason  string
	OnBattery    bool
	BatteryKnown bool
	CPUCapPct    int
	CPUCapState  string
	CPUCapDetail string
	// PauseUntil is the end of a timed pause from the tray; zero when none.
	PauseUntil time.Time
	ReportedAt time.Time
}

// defaultPolicy is the answer for a machine that has reported nothing: it
// accepts, so an older agent keeps working.
func defaultPolicy() Policy { return Policy{Accepting: true} }

// HandleAccepting stores the agent's AcceptingReport. A change reaches the
// console and the tray through the usual notification.
func (s *Service) HandleAccepting(_ context.Context, machineID string, r *agentv1.AcceptingReport) {
	p := Policy{
		Accepting: r.GetAccepting(), PauseReason: r.GetPauseReason(), OnBattery: r.GetOnBattery(), BatteryKnown: r.GetBatteryKnown(),
		CPUCapPct: int(r.GetCpuCapPct()), CPUCapState: r.GetCpuCapState(), CPUCapDetail: r.GetCpuCapDetail(), ReportedAt: s.now(),
	}
	if p.Accepting {
		p.PauseReason = ""
	}
	if ms := r.GetPauseUntilUnixMs(); ms > 0 {
		p.PauseUntil = time.UnixMilli(ms).UTC()
	}
	s.mu.Lock()
	old, had := s.policies[machineID]
	s.policies[machineID] = p
	s.mu.Unlock()
	if !had || old.Accepting != p.Accepting || old.PauseReason != p.PauseReason || old.OnBattery != p.OnBattery ||
		old.CPUCapState != p.CPUCapState || old.CPUCapPct != p.CPUCapPct {
		s.notifyMachine(machineID)
	}
}

// Policy returns the newest report of a machine; a machine that reported
// nothing accepts.
func (s *Service) Policy(machineID string) Policy {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p, ok := s.policies[machineID]; ok {
		return p
	}
	return defaultPolicy()
}

// Accepting is the status other features read: online and accepting new jobs,
// and the reason when it does not (R5.60).
func (s *Service) Accepting(ctx context.Context, machineID string) (online, accepting bool, reason string, err error) {
	m, err := s.o.Repo.GetMachine(ctx, machineID)
	if err != nil {
		return false, false, "", err
	}
	p := s.Policy(machineID)
	return m.Online, p.Accepting, p.PauseReason, nil
}

// validatePolicy checks the ranges of R5.59 and R5.62.
func validatePolicy(set Settings) error {
	bad := func(format string, a ...any) error {
		return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
	}
	switch set.EffectiveMode() {
	case ModeAutomatic, ModeAlways, ModePaused:
	default:
		return bad("the machine mode is automatic, always or paused")
	}
	if !validCap(set.EffectiveCPUCap()) {
		return bad("the CPU cap is 25, 50, 75 or 100 percent")
	}
	return nil
}

func validCap(pct int) bool {
	for _, c := range CPUCaps {
		if pct == c {
			return true
		}
	}
	return false
}

// applyPolicy applies the policy fields of an update. now is the controller
// clock: a timed pause is an absolute time the agent compares to its own clock.
func applyPolicy(set Settings, u SettingsUpdate, now time.Time) (Settings, error) {
	if u.Mode != nil {
		switch *u.Mode {
		case ModeAutomatic, ModeAlways, ModePaused:
		default:
			return set, fmt.Errorf("%w: the machine mode is automatic, always or paused", ErrInvalid)
		}
		set.Mode = *u.Mode
	}
	if u.PauseOnBattery != nil {
		set.PauseOnBattery = *u.PauseOnBattery
	}
	if u.CPUCapPct != nil {
		if !validCap(*u.CPUCapPct) {
			return set, fmt.Errorf("%w: the CPU cap is 25, 50, 75 or 100 percent", ErrInvalid)
		}
		set.CPUCapPct = *u.CPUCapPct
	}
	if u.Pause != nil {
		switch *u.Pause {
		case PauseOneHour:
			set.PauseUntil, set.PausedUntilResumed = now.Add(time.Hour).UTC(), false
		case PauseUntilResumedValue:
			set.PauseUntil, set.PausedUntilResumed = time.Time{}, true
		case PauseNone:
			set.PauseUntil, set.PausedUntilResumed = time.Time{}, false
		default:
			return set, fmt.Errorf("%w: a pause is one_hour, until_resumed or none", ErrInvalid)
		}
	}
	return set, nil
}

// fillPolicy puts the reported policy on the machine record of a view.
func (s *Service) fillPolicy(m *Machine) {
	p := s.Policy(m.ID)
	m.Accepting, m.PauseReason = p.Accepting, p.PauseReason
}
