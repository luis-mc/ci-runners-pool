package agent

import (
	"context"
	"errors"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"

	"connectrpc.com/connect"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/load"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
)

// Config configures the agent.
type Config struct {
	// Controller is host:port of the agent link (default port 8461).
	Controller string
	// Pin is the controller CA fingerprint (SHA-256, hex) from the install command.
	Pin string
	// JoinCode is the one-time code; used only while the agent holds no key.
	JoinCode string
	// LocalCredentialFile is the file the controller writes for its own
	// machine's agent (R5.1). It is read at join and again if the machine key
	// is refused.
	LocalCredentialFile string
	Secrets             secrets.Store
	DataDir             string
	Version             string
	Logger              *slog.Logger
	Sys                 Sys
	Sampler             *load.Sampler
	Gate                *Gate

	// Intervals; the defaults are the spec's (R5.35, R5.13, R5.16).
	HeartbeatEvery time.Duration // 10 s
	LoadEvery      time.Duration // 15 s
	RedetectEvery  time.Duration // 10 min
	SampleEvery    time.Duration // 5 s
	DrainPollEvery time.Duration // 2 s
	// Backoff is the reconnect delay; Sleep waits for it (tests replace both).
	Backoff *Backoff
	Sleep   func(ctx context.Context, d time.Duration) error
}

func (c Config) sys() Sys {
	if c.Sys != nil {
		return c.Sys
	}
	return OSSys{}
}

func (c Config) cache() SettingsCache { return SettingsCache{Path: c.DataDir + "/settings.json"} }

func (c *Config) defaults() {
	if c.Logger == nil {
		c.Logger = slog.Default()
	}
	if c.Sampler == nil {
		c.Sampler = load.NewSampler(c.sys())
	}
	if c.Gate == nil {
		c.Gate = NewGate(c.Sampler)
	}
	for _, d := range []struct {
		p *time.Duration
		v time.Duration
	}{
		{&c.HeartbeatEvery, machines.HeartbeatEvery}, {&c.LoadEvery, 15 * time.Second}, {&c.RedetectEvery, 10 * time.Minute},
		{&c.SampleEvery, load.SampleEvery}, {&c.DrainPollEvery, 2 * time.Second},
	} {
		if *d.p == 0 {
			*d.p = d.v
		}
	}
	if c.Backoff == nil {
		c.Backoff = &Backoff{}
	}
	if c.Sleep == nil {
		c.Sleep = func(ctx context.Context, d time.Duration) error {
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-t.C:
				return nil
			}
		}
	}
}

// SettingsFromProto converts the wire settings.
func SettingsFromProto(p *agentv1.MachineSettings) machines.Settings {
	return machines.Settings{
		Version: p.GetVersion(), State: p.GetState(),
		BudgetMemoryPct: int(p.GetBudgetMemoryPct()), BudgetCPUPct: int(p.GetBudgetCpuPct()), JobSlots: int(p.GetJobSlots()),
		LightSlots: int(p.GetLightSlots()), HeavySlots: int(p.GetHeavySlots()), LightJobs: p.GetLightJobs(), HeavyJobs: p.GetHeavyJobs(),
		SlotMaxAgeMinutes: int(p.GetSlotMaxAgeMinutes()), GatePollSeconds: int(p.GetGatePollSeconds()),
		GateMaxWaitMinutes: int(p.GetGateMaxWaitMinutes()), GateOnTimeout: p.GetGateOnTimeout(),
		AllowedBackends: p.GetAllowedBackends(), CacheCapBytes: p.GetCacheCapBytes(),
		DrainTimeoutMinutes: int(p.GetDrainTimeoutMinutes()), WindowsSymlinkRight: p.GetWindowsSymlinkRight(),
	}
}

// Run is the agent. It joins when it holds no key, then keeps one Session open,
// reconnecting with backoff (R5.36). It returns nil when ctx ends, ErrRemoved
// when the controller refused the key (R5.39), and ErrPinMismatch when the
// controller's certificate is not the pinned one (R5.5). It never listens on a
// port (R5.9).
func Run(ctx context.Context, cfg Config) error {
	cfg.defaults()
	log := cfg.Logger
	if s, state, ok := cfg.cache().Load(); ok {
		cfg.Gate.SetSettings(s, state) // R5.24: apply the last settings while the link is down
	}
	var wg sync.WaitGroup
	sctx, stopSampling := context.WithCancel(ctx)
	defer func() { stopSampling(); wg.Wait() }()
	wg.Add(1)
	go func() { defer wg.Done(); sampleLoop(sctx, cfg) }()

	for ctx.Err() == nil {
		key, id, pin, err := cfg.loadIdentity(ctx)
		if errors.Is(err, secrets.ErrNotFound) {
			if jerr := joinFirst(ctx, cfg); jerr != nil {
				return jerr
			}
			continue
		}
		if err != nil {
			return err // the secret store is down: fail closed
		}
		err = runSession(ctx, cfg, key, id, pin)
		switch {
		case ctx.Err() != nil:
			return nil
		case errors.Is(err, ErrRemoved):
			log.Error("this machine was removed from the pool")
			cfg.forget(ctx)
			if cfg.LocalCredentialFile == "" {
				return ErrRemoved // wait for a new join (R5.39)
			}
			cfg.Backoff.Reset()
			continue // the controller's own agent joins again the same way (R5.1)
		case errors.Is(err, ErrPinMismatch):
			return err
		case err != nil:
			d := cfg.Backoff.Next()
			log.Warn("link lost; reconnecting", "err", err, "in", d.String())
			if serr := cfg.Sleep(ctx, d); serr != nil {
				return nil
			}
		}
	}
	return nil
}

func joinFirst(ctx context.Context, cfg Config) error {
	code, local := strings.TrimSpace(cfg.JoinCode), false
	if code == "" && cfg.LocalCredentialFile != "" {
		b, err := os.ReadFile(cfg.LocalCredentialFile)
		if err != nil {
			return errors.New("no join code and no local credential: " + err.Error())
		}
		code, local = strings.TrimSpace(string(b)), true
	}
	if code == "" {
		return errors.New("this machine has not joined a controller: give a join code (crsp agent install)")
	}
	if err := Join(ctx, cfg, code, local); err != nil {
		return err
	}
	cfg.Logger.Info("joined the controller")
	return nil
}

func sampleLoop(ctx context.Context, cfg Config) {
	cfg.Sampler.Refresh()
	cfg.Sampler.Sample()
	t := time.NewTicker(cfg.SampleEvery)
	defer t.Stop()
	n := 0
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			n++
			if n%6 == 0 { // every 30 s with the 5 s default
				go cfg.Sampler.Refresh()
			}
			cfg.Sampler.Sample()
		}
	}
}

func jobToProto(j machines.JobRef) *agentv1.JobRef {
	return &agentv1.JobRef{Repository: j.Repository, RunId: j.RunID, RunAttempt: int32(j.RunAttempt), Job: j.Job, GithubJobId: j.GitHubJobID, RunnerName: j.RunnerName} //nolint:gosec // small
}

func loadToProto(r load.Report, slots int) *agentv1.LoadReport {
	return &agentv1.LoadReport{
		SampledAtUnixMs: r.SampledAt.UnixMilli(), MemoryPct: r.MemoryPct, MemoryKnown: r.MemoryKnown, CpuPct: r.CPUPct, CpuKnown: r.CPUKnown,
		UnknownReason: r.UnknownReason, WslVmBytes: r.WSLVMBytes, ContainersBytes: r.ContainersBytes,
		SlotsUsed: int32(slots), CgroupLimited: r.CgroupLimited, //nolint:gosec // small
	}
}

type link struct {
	cfg    Config
	stream *connect.BidiStreamForClient[agentv1.SessionRequest, agentv1.SessionResponse]
	sendMu sync.Mutex
	facts  *agentv1.Facts
	factMu sync.Mutex

	drainMu sync.Mutex
	drainID string // command id of the drain in progress; empty when none
}

func (l *link) send(m *agentv1.SessionRequest) error {
	l.sendMu.Lock()
	defer l.sendMu.Unlock()
	return l.stream.Send(m)
}

func (l *link) redetect(ctx context.Context) *agentv1.Facts {
	f := DetectAll(ctx, l.cfg.sys(), l.cfg.DataDir, time.Now())
	l.factMu.Lock()
	l.facts = f
	l.factMu.Unlock()
	return f
}

func runSession(ctx context.Context, cfg Config, key, id, pin string) error {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()
	l := &link{cfg: cfg}
	l.stream = newClient(pin, cfg.Controller).Session(ctx)
	l.stream.RequestHeader().Set("Authorization", "Bearer "+key)
	l.stream.RequestHeader().Set("Crsp-Machine-Id", id)

	facts := l.redetect(ctx)
	rep, _ := cfg.Sampler.Latest()
	set, _ := cfg.Gate.Settings()
	var running []*agentv1.JobRef
	for _, j := range cfg.Gate.Running() {
		running = append(running, jobToProto(j))
	}
	hello := &agentv1.Hello{
		MachineId: id, AgentVersion: cfg.Version, ProtocolVersion: agentv1.ProtocolVersion_PROTOCOL_VERSION_1,
		SettingsVersion: set.Version, Facts: facts, Load: loadToProto(rep, cfg.Gate.SlotsUsed()),
		Holders: &agentv1.HolderReport{Running: running},
	}
	if err := l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_Hello{Hello: hello}}); err != nil {
		return classify(err)
	}
	ack, err := l.stream.Receive()
	if err != nil {
		return classify(err)
	}
	if ack.GetHelloAck() == nil {
		return errors.New("the controller did not answer Hello")
	}
	if s := ack.GetHelloAck().GetSettings(); s != nil {
		applySettings(cfg, s)
	}
	cfg.Backoff.Reset() // a successful session resets the backoff (R5.36)
	cfg.Logger.Info("session open")

	lastRecv := newStamp()
	go l.sendLoop(ctx, cancel, lastRecv)

	for {
		msg, err := l.stream.Receive()
		if err != nil {
			if ctx.Err() != nil {
				return nil
			}
			return classify(err)
		}
		lastRecv.set()
		if rerr := l.handle(ctx, msg); rerr != nil {
			return rerr
		}
	}
}

func classify(err error) error {
	if connect.CodeOf(err) == connect.CodeUnauthenticated {
		return ErrRemoved
	}
	if isPinError(err) {
		return ErrPinMismatch
	}
	return err
}

func applySettings(cfg Config, s *agentv1.MachineSettings) {
	cfg.Gate.SetSettings(SettingsFromProto(s), s.GetState())
	if err := cfg.cache().Save(SettingsFromProto(s), s.GetState()); err != nil {
		cfg.Logger.Warn("settings could not be cached", "err", err)
	}
}

type stamp struct {
	mu sync.Mutex
	t  time.Time
}

func newStamp() *stamp { return &stamp{t: time.Now()} }
func (s *stamp) set()  { s.mu.Lock(); s.t = time.Now(); s.mu.Unlock() }
func (s *stamp) age() time.Duration {
	s.mu.Lock()
	defer s.mu.Unlock()
	return time.Since(s.t)
}

// sendLoop sends heartbeats, load reports, periodic facts and drain status. When
// the controller has been silent for three heartbeats it ends the session so the
// agent reconnects (R5.35, R5.36).
func (l *link) sendLoop(ctx context.Context, cancel context.CancelFunc, lastRecv *stamp) {
	cfg := l.cfg
	hb := time.NewTicker(cfg.HeartbeatEvery)
	ld := time.NewTicker(cfg.LoadEvery)
	rd := time.NewTicker(cfg.RedetectEvery)
	dr := time.NewTicker(cfg.DrainPollEvery)
	defer hb.Stop()
	defer ld.Stop()
	defer rd.Stop()
	defer dr.Stop()
	fail := func(err error) bool {
		if err != nil {
			cancel()
			return true
		}
		return false
	}
	for {
		select {
		case <-ctx.Done():
			return
		case <-hb.C:
			if lastRecv.age() > 3*cfg.HeartbeatEvery {
				cancel()
				return
			}
			if fail(l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_Heartbeat{Heartbeat: &agentv1.Heartbeat{SentAtUnixMs: time.Now().UnixMilli()}}})) {
				return
			}
		case <-ld.C:
			rep, _ := cfg.Sampler.Latest()
			if fail(l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_LoadReport{LoadReport: loadToProto(rep, cfg.Gate.SlotsUsed())}})) {
				return
			}
		case <-rd.C:
			if fail(l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_Facts{Facts: l.redetect(ctx)}})) {
				return
			}
		case <-dr.C:
			if fail(l.reportDrain()) {
				return
			}
		}
	}
}

func (l *link) setDrain(id string) {
	l.drainMu.Lock()
	l.drainID = id
	l.drainMu.Unlock()
}

// reportDrain sends the drain status: the idle check and the hold are one step
// in Gate.Hold (R5.32). It sends nothing while no drain is in progress.
func (l *link) reportDrain() error {
	l.drainMu.Lock()
	id := l.drainID
	l.drainMu.Unlock()
	if id == "" {
		return nil
	}
	idle, waiting := l.cfg.Gate.Hold()
	st := &agentv1.DrainStatus{CommandId: id, Idle: idle}
	for _, j := range waiting {
		st.WaitingFor = append(st.WaitingFor, jobToProto(j))
	}
	if idle {
		l.setDrain("") // the controller acts on this one report
	}
	return l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_DrainStatus{DrainStatus: st}})
}

func (l *link) handle(ctx context.Context, msg *agentv1.SessionResponse) error {
	cfg := l.cfg
	switch m := msg.GetMessage().(type) {
	case *agentv1.SessionResponse_Settings:
		applySettings(cfg, m.Settings)
	case *agentv1.SessionResponse_Drain:
		l.setDrain(m.Drain.GetCommandId())
		_ = l.reportDrain() // the first check right away
	case *agentv1.SessionResponse_Resume:
		l.setDrain("")
		cfg.Gate.Release()
	case *agentv1.SessionResponse_Redetect:
		f := l.redetect(ctx)
		_ = l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_Facts{Facts: f}})
		_ = l.send(&agentv1.SessionRequest{Message: &agentv1.SessionRequest_CommandResult{CommandResult: &agentv1.CommandResult{CommandId: m.Redetect.GetCommandId(), Ok: true, Outcome: "done"}}})
	case *agentv1.SessionResponse_MachineRemoved:
		return ErrRemoved
	}
	return nil
}
