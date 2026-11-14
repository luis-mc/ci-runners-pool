package machines

import (
	"context"
	"fmt"
	"reflect"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

// MarkSeen records a heartbeat or any message: the machine is online (R5.35).
func (s *Service) MarkSeen(ctx context.Context, machineID string) error {
	m, err := s.o.Repo.GetMachine(ctx, machineID)
	if err != nil {
		return err
	}
	changed := !m.Online
	m.Online, m.LastSeen = true, s.now()
	if err := s.o.Repo.UpdateMachine(ctx, m); err != nil {
		return err
	}
	if changed {
		s.notifyMachine(machineID)
	}
	return nil
}

// Tick does the periodic work: it marks a machine that sent nothing for 30
// seconds offline (R5.35), moves a drain that passed its timeout to "needs
// you" without stopping anything (R5.33), and drops load older than 24 hours
// (R6.8). The controller calls it every few seconds.
func (s *Service) Tick(ctx context.Context) error {
	now := s.now()
	ms, err := s.o.Repo.ListMachines(ctx)
	if err != nil {
		return err
	}
	for _, m := range ms {
		if m.Online && now.Sub(m.LastSeen) > OfflineAfter {
			m.Online = false
			if err := s.o.Repo.UpdateMachine(ctx, m); err != nil {
				return err
			}
			s.notifyMachine(m.ID)
		}
	}
	cs, err := s.o.Repo.OpenChanges(ctx)
	if err != nil {
		return err
	}
	for _, c := range cs {
		if c.State == ChangeWaiting && now.After(c.Deadline) {
			c.State = ChangeNeedsYou
			if err := s.o.Repo.UpdateChange(ctx, c); err != nil {
				return err
			}
			_ = s.o.Repo.Audit(ctx, "system", "machine.drain.timeout", c.MachineID, c.Kind)
			s.notifyMachine(c.MachineID)
		}
	}
	return s.o.Repo.DeleteLoadBefore(ctx, now.Add(-LoadRetention))
}

// Run calls Tick every interval until ctx ends.
func (s *Service) Run(ctx context.Context, interval time.Duration, onErr func(error)) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if err := s.Tick(ctx); err != nil && onErr != nil {
				onErr(err)
			}
		}
	}
}

// HandleLoad stores the newest load and, at 15-second steps, the history (R6.8).
func (s *Service) HandleLoad(ctx context.Context, machineID string, r *agentv1.LoadReport) error {
	now := s.now()
	l := Load{
		MemoryPct: r.GetMemoryPct(), MemoryKnown: r.GetMemoryKnown(), CPUPct: r.GetCpuPct(), CPUKnown: r.GetCpuKnown(),
		UnknownReason: r.GetUnknownReason(), SlotsUsed: int(r.GetSlotsUsed()), ReceivedAt: now,
		SampledAt: time.UnixMilli(r.GetSampledAtUnixMs()).UTC(),
	}
	if r.GetSampledAtUnixMs() == 0 {
		l.SampledAt = now
	}
	s.mu.Lock()
	s.loads[machineID] = l
	last := s.lastKept[machineID]
	keep := now.Sub(last) >= LoadStep
	if keep {
		s.lastKept[machineID] = now
	}
	s.mu.Unlock()
	if keep {
		p := LoadPoint{At: now.Truncate(time.Second), SlotsUsed: l.SlotsUsed}
		if l.MemoryKnown {
			v := l.MemoryPct
			p.MemoryPct = &v
		}
		if l.CPUKnown {
			v := l.CPUPct
			p.CPUPct = &v
		}
		if err := s.o.Repo.InsertLoad(ctx, machineID, p); err != nil {
			return err
		}
	}
	if s.o.Notify != nil {
		s.o.Notify.LoadChanged(machineID)
	}
	return nil
}

// CurrentLoad returns the newest load of a machine, if any.
func (s *Service) CurrentLoad(machineID string) (Load, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	l, ok := s.loads[machineID]
	return l, ok
}

// LoadHistory returns stored samples, oldest first (R6.8). It never goes back
// more than 24 hours.
func (s *Service) LoadHistory(ctx context.Context, machineID string, from, to time.Time) ([]LoadPoint, error) {
	now := s.now()
	if to.IsZero() {
		to = now
	}
	if min := now.Add(-LoadRetention); from.Before(min) {
		from = min
	}
	if _, err := s.o.Repo.GetMachine(ctx, machineID); err != nil {
		return nil, err
	}
	return s.o.Repo.ListLoad(ctx, machineID, from, to)
}

// FactsFromProto converts the wire facts.
func FactsFromProto(f *agentv1.Facts) Facts {
	out := Facts{
		HostName: f.GetHostName(), OS: f.GetOs(), OSName: f.GetOsName(), OSVersion: f.GetOsVersion(), KernelVersion: f.GetKernelVersion(),
		Arch: f.GetArch(), CPUModel: f.GetCpuModel(), Cores: int(f.GetCores()), Threads: int(f.GetThreads()),
		MemoryBytes: f.GetMemoryBytes(), DiskTotalBytes: f.GetDiskTotalBytes(), DiskFreeBytes: f.GetDiskFreeBytes(),
	}
	if f.GetDetectedAtUnixMs() > 0 {
		out.DetectedAt = time.UnixMilli(f.GetDetectedAtUnixMs()).UTC()
	}
	for _, g := range f.GetGpus() {
		out.GPUs = append(out.GPUs, Gpu{Vendor: g.GetVendor(), Model: g.GetModel(), MemoryBytes: g.GetMemoryBytes()})
	}
	return out
}

// BackendsFromProto converts the wire backends.
func BackendsFromProto(f *agentv1.Facts) []Backend {
	var out []Backend
	for _, b := range f.GetBackends() {
		out = append(out, Backend{Name: b.GetName(), Present: b.GetPresent(), Usable: b.GetUsable(), Version: b.GetVersion(), Reason: b.GetReason(), Rootless: b.GetRootless()})
	}
	return out
}

// HandleFacts stores the facts and backends. A change is written to the audit
// log (R5.13).
func (s *Service) HandleFacts(ctx context.Context, machineID, agentVersion string, pf *agentv1.Facts) error {
	if pf == nil {
		return nil
	}
	m, err := s.o.Repo.GetMachine(ctx, machineID)
	if err != nil {
		return err
	}
	facts, backends := FactsFromProto(pf), BackendsFromProto(pf)
	facts.AgentVersion = agentVersion
	old := m.Facts
	old.DetectedAt, facts.DetectedAt = time.Time{}, time.Time{}
	changed := !reflect.DeepEqual(old, facts) || !reflect.DeepEqual(m.Backends, backends)
	facts.DetectedAt = FactsFromProto(pf).DetectedAt
	m.Facts, m.Backends, m.AgentVersion = facts, backends, agentVersion
	if facts.OS != "" {
		m.OS = facts.OS
	}
	if facts.Arch != "" {
		m.Arch = facts.Arch
	}
	if err := s.o.Repo.UpdateMachine(ctx, m); err != nil {
		return err
	}
	if changed {
		_ = s.o.Repo.Audit(ctx, "agent", "machine.facts.change", machineID, fmt.Sprintf("%d backends reported", len(backends)))
		s.notifyMachine(machineID)
	}
	return nil
}

// Redetect asks the agent to detect facts and backends now (Check again, R5.13).
func (s *Service) Redetect(ctx context.Context, actor, machineID string) error {
	if _, err := s.o.Repo.GetMachine(ctx, machineID); err != nil {
		return err
	}
	if err := s.sessions.send(machineID, &agentv1.SessionResponse{Message: &agentv1.SessionResponse_Redetect{Redetect: &agentv1.Redetect{CommandId: newID("cmd_")}}}); err != nil {
		return err
	}
	_ = s.o.Repo.Audit(ctx, actor, "machine.redetect", machineID, "")
	return nil
}
