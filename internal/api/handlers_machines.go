package api

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

// MachinesService is what the machines routes need (machines R5.50 to R5.52,
// R6.4). *machines.Service implements it.
type MachinesService interface {
	List(ctx context.Context) ([]machines.View, error)
	Get(ctx context.Context, id string) (machines.View, error)
	UpdateSettings(ctx context.Context, actor, id string, u machines.SettingsUpdate) (machines.View, *machines.Change, error)
	Drain(ctx context.Context, actor, id, reason string) (machines.Change, error)
	Resume(ctx context.Context, actor, id string, confirm bool) (machines.View, error)
	Remove(ctx context.Context, actor, id string, confirm bool) (machines.Change, error)
	Redetect(ctx context.Context, actor, id string) error
	LoadHistory(ctx context.Context, id string, from, to time.Time) ([]machines.LoadPoint, error)
	GetChange(ctx context.Context, machineID, id string) (machines.Change, error)
	DecideChange(ctx context.Context, actor, machineID, changeID string, d machines.Decision, waitMinutes int, confirm bool) (machines.Change, error)
	CreateJoinCode(ctx context.Context, actor string, ttl time.Duration) (machines.CreatedCode, error)
	GetJoinCode(ctx context.Context, id string) (machines.JoinCode, machines.CodeState, error)
	RevokeJoinCode(ctx context.Context, actor, id string) error
	InstallCommands(code string) []machines.InstallCommand
	ControllerInfo() (address string, port int, fingerprint string)
}

var _ MachinesService = (*machines.Service)(nil)

// CAProvider gives the controller CA certificate for the one-click download.
type CAProvider interface{ CAPEM() []byte }

type errShape = struct {
	Body       gen.ErrorEnvelope
	StatusCode int
}

// machineErr maps a machines error to the error envelope of any operation's
// default response.
func machineErr[T ~struct {
	Body       gen.ErrorEnvelope
	StatusCode int
}](log func(string, ...any), err error) T {
	status, env := mapMachinesError(log, err)
	return T(errShape{Body: env, StatusCode: status})
}

func mapMachinesError(log func(string, ...any), err error) (int, gen.ErrorEnvelope) {
	env := func(code, msg string) gen.ErrorEnvelope {
		return gen.ErrorEnvelope{Error: gen.ErrorBody{Code: code, Message: msg}}
	}
	var nc *machines.NeedsConfirmationError
	switch {
	case errors.As(err, &nc):
		details := make([]gen.ErrorDetail, 0, len(nc.Names))
		for _, n := range nc.Names {
			details = append(details, gen.ErrorDetail{Kind: "item", Text: n})
		}
		e := env(CodeNeedsConfirmation, nc.Message)
		e.Error.Details = &details
		return http.StatusConflict, e
	case errors.Is(err, machines.ErrNotFound):
		return http.StatusNotFound, env(CodeNotFound, "no such machine, change or join code")
	case errors.Is(err, machines.ErrInvalid):
		return http.StatusBadRequest, env(CodeBadRequest, err.Error())
	case errors.Is(err, machines.ErrConflict):
		return http.StatusConflict, env(CodeConflict, err.Error())
	case errors.Is(err, machines.ErrOffline):
		return http.StatusConflict, env(CodeConflict, "the machine is offline; the change will reach it when it connects")
	case errors.Is(err, machines.ErrNotSupported):
		return http.StatusNotImplemented, env(CodeNotImplemented, err.Error())
	case errors.Is(err, machines.ErrUnauthenticated):
		return http.StatusUnauthorized, env(CodeUnauthenticated, "unknown or revoked key")
	}
	if log != nil {
		log("machines: handler failed", "err", err)
	}
	return http.StatusServiceUnavailable, env(CodeUnavailable, "the controller cannot reach its database right now")
}

func (s *server) machinesOff() bool { return s.opts.Machines == nil }

func unavailable[T ~struct {
	Body       gen.ErrorEnvelope
	StatusCode int
}]() T {
	return T(errShape{StatusCode: http.StatusNotImplemented, Body: notImplemented()})
}

func fail[T ~struct {
	Body       gen.ErrorEnvelope
	StatusCode int
}](s *server, err error) T {
	return machineErr[T](func(m string, a ...any) { s.opts.Logger.Error(m, a...) }, err)
}

func (s *server) actor(ctx context.Context) string { return machines.ActorFrom(ctx) }

// ---------------------------------------------------------------- conversions

func tptr[T any](v T) *T { return &v }

func jobToAPI(j machines.JobRef) gen.Job {
	out := gen.Job{
		Id: j.GitHubJobID, GithubJobId: j.GitHubJobID, JobName: j.Job, Labels: []string{}, Repository: j.Repository,
		RunAttempt: j.RunAttempt, RunId: j.RunID, State: gen.JobStateRunning,
	}
	if j.RunnerName != "" {
		out.RunnerName = tptr(j.RunnerName)
	}
	if !j.StartedAt.IsZero() {
		out.StartedAt = tptr(j.StartedAt)
	}
	return out
}

func changeToAPI(c machines.Change) gen.MachineChange {
	out := gen.MachineChange{
		Id: c.ID, MachineId: c.MachineID, Kind: gen.MachineChangeKind(c.Kind), State: gen.MachineChangeState(c.State),
		StartedAt: c.StartedAt, WaitingFor: []gen.Job{},
	}
	if !c.Deadline.IsZero() {
		out.DeadlineAt = tptr(c.Deadline)
	}
	for _, j := range c.Detail.WaitingFor {
		out.WaitingFor = append(out.WaitingFor, jobToAPI(j))
	}
	return out
}

func settingsToAPI(st machines.Settings) gen.MachineSettings {
	backends := make([]gen.BackendName, 0, len(st.AllowedBackends))
	for _, b := range st.AllowedBackends {
		backends = append(backends, gen.BackendName(b))
	}
	out := gen.MachineSettings{
		AllowedBackends: backends, BudgetCpuPct: st.BudgetCPUPct, BudgetMemoryPct: st.BudgetMemoryPct,
		CacheCapBytes: tptr(st.CacheCapBytes), DrainTimeoutMinutes: st.DrainTimeoutMinutes,
		GateMaxWaitMinutes: tptr(st.GateMaxWaitMinutes), GatePollSeconds: tptr(st.GatePollSeconds),
		HeavySlots: st.HeavySlots, JobSlots: st.JobSlots, LightSlots: st.LightSlots,
		SlotMaxAgeMinutes: tptr(st.SlotMaxAgeMinutes), WindowsSymlinkRight: st.WindowsSymlinkRight,
		HeavyJobs: tptr(append([]string{}, st.HeavyJobs...)), LightJobs: tptr(append([]string{}, st.LightJobs...)),
	}
	if st.GateOnTimeout != "" {
		out.GateOnTimeout = tptr(gen.MachineSettingsGateOnTimeout(st.GateOnTimeout))
	}
	return out
}

func f32(v float64) *float32 { x := float32(v); return &x }

func machineToAPI(v machines.View, now time.Time) gen.Machine {
	m := v.Machine
	out := gen.Machine{
		Id: m.ID, Name: m.Name, Os: gen.OS(m.OS), Arch: gen.Arch(m.Arch), State: gen.MachineState(m.State), Online: m.Online,
		IsController: m.IsController, Settings: settingsToAPI(v.Settings), SlotsUsed: v.SlotsUsed, LastSeenAt: m.LastSeen,
		Backends: []gen.BackendSupport{},
	}
	if !m.JoinedAt.IsZero() {
		out.JoinedAt = tptr(m.JoinedAt)
	}
	for _, b := range v.Backends {
		bs := gen.BackendSupport{Name: gen.BackendName(b.Name), Present: b.Present, Usable: b.Usable, Allowed: b.Allowed}
		if b.Version != "" {
			bs.Version = tptr(b.Version)
		}
		if b.Reason != "" {
			bs.Reason = tptr(b.Reason)
		}
		if b.Rootless {
			bs.Rootless = tptr(true)
		}
		out.Backends = append(out.Backends, bs)
	}
	f := m.Facts
	facts := gen.MachineFacts{
		AgentVersion: tptr(m.AgentVersion), Cores: tptr(f.Cores), CpuModel: tptr(f.CPUModel), DiskFreeBytes: tptr(f.DiskFreeBytes),
		DiskTotalBytes: tptr(f.DiskTotalBytes), HostName: tptr(f.HostName), KernelVersion: tptr(f.KernelVersion),
		MemoryBytes: tptr(f.MemoryBytes), OsName: tptr(f.OSName), OsVersion: tptr(f.OSVersion), Threads: tptr(f.Threads),
	}
	if !f.DetectedAt.IsZero() {
		facts.DetectedAt = tptr(f.DetectedAt)
	}
	gpus := []struct {
		MemoryBytes *int64  `json:"memory_bytes,omitempty"`
		Model       *string `json:"model,omitempty"`
		Vendor      *string `json:"vendor,omitempty"`
	}{}
	for _, g := range f.GPUs {
		gpus = append(gpus, struct {
			MemoryBytes *int64  `json:"memory_bytes,omitempty"`
			Model       *string `json:"model,omitempty"`
			Vendor      *string `json:"vendor,omitempty"`
		}{MemoryBytes: tptr(g.MemoryBytes), Model: tptr(g.Model), Vendor: tptr(g.Vendor)})
	}
	facts.Gpus = &gpus
	out.Facts = &facts
	if v.Load != nil {
		l := gen.Load{MemoryKnown: v.Load.MemoryKnown, CpuKnown: v.Load.CPUKnown, SampledAt: v.Load.SampledAt, Stale: v.Load.Stale(now)}
		if v.Load.MemoryKnown {
			l.MemoryPct = f32(v.Load.MemoryPct)
		}
		if v.Load.CPUKnown {
			l.CpuPct = f32(v.Load.CPUPct)
		}
		if v.Load.UnknownReason != "" {
			l.UnknownReason = tptr(v.Load.UnknownReason)
		}
		out.Load = &l
	}
	jobs := make([]gen.Job, 0, len(v.RunningJobs))
	for _, j := range v.RunningJobs {
		jobs = append(jobs, jobToAPI(j))
	}
	out.RunningJobs = &jobs
	if v.PendingChange != nil {
		c := changeToAPI(*v.PendingChange)
		out.PendingChange = &c
	}
	return out
}

func installToAPI(svc MachinesService, code string) gen.InstallCommands {
	addr, port, fp := svc.ControllerInfo()
	out := gen.InstallCommands{ControllerAddress: addr, AgentPort: port, CertSha256: fp}
	for _, c := range svc.InstallCommands(code) {
		out.Items = append(out.Items, struct {
			Command string `json:"command"`
			Os      gen.OS `json:"os"`
		}{Command: c.Command, Os: gen.OS(c.OS)})
	}
	return out
}

func codeToAPI(c machines.JoinCode, st machines.CodeState) gen.JoinCode {
	out := gen.JoinCode{Id: c.ID, State: gen.JoinCodeState(st), CreatedAt: c.CreatedAt, ExpiresAt: c.ExpiresAt}
	if c.MachineID != "" {
		out.MachineId = tptr(c.MachineID)
	}
	return out
}

// ---------------------------------------------------------------- handlers

// ListMachines implements GET /api/v1/machines (machines R5.50).
func (s *server) ListMachines(ctx context.Context, _ gen.ListMachinesRequestObject) (gen.ListMachinesResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.ListMachinesdefaultJSONResponse](), nil
	}
	vs, err := s.opts.Machines.List(ctx)
	if err != nil {
		return fail[gen.ListMachinesdefaultJSONResponse](s, err), nil
	}
	now := time.Now()
	out := gen.ListMachines200JSONResponse{Items: make([]gen.Machine, 0, len(vs))}
	for _, v := range vs {
		out.Items = append(out.Items, machineToAPI(v, now))
	}
	return out, nil
}

// GetMachine implements GET /api/v1/machines/{machineId}.
func (s *server) GetMachine(ctx context.Context, r gen.GetMachineRequestObject) (gen.GetMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.GetMachinedefaultJSONResponse](), nil
	}
	v, err := s.opts.Machines.Get(ctx, r.MachineId)
	if err != nil {
		return fail[gen.GetMachinedefaultJSONResponse](s, err), nil
	}
	return gen.GetMachine200JSONResponse(machineToAPI(v, time.Now())), nil
}

// UpdateMachine implements PATCH /api/v1/machines/{machineId} (machines R5.22 to R5.26).
func (s *server) UpdateMachine(ctx context.Context, r gen.UpdateMachineRequestObject) (gen.UpdateMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.UpdateMachinedefaultJSONResponse](), nil
	}
	if r.Body == nil {
		return fail[gen.UpdateMachinedefaultJSONResponse](s, machines.ErrInvalid), nil
	}
	b := r.Body
	u := machines.SettingsUpdate{
		Name: b.Name, BudgetMemoryPct: b.BudgetMemoryPct, BudgetCPUPct: b.BudgetCpuPct, JobSlots: b.JobSlots,
		LightSlots: b.LightSlots, HeavySlots: b.HeavySlots, LightJobs: b.LightJobs, HeavyJobs: b.HeavyJobs,
		CacheCapBytes: b.CacheCapBytes, DrainTimeoutMinutes: b.DrainTimeoutMinutes, WindowsSymlinkRight: b.WindowsSymlinkRight,
		Confirm: b.Confirm != nil && *b.Confirm,
	}
	if b.GateOnTimeout != nil {
		u.GateOnTimeout = tptr(string(*b.GateOnTimeout))
	}
	if b.AllowedBackends != nil {
		names := make([]string, 0, len(*b.AllowedBackends))
		for _, n := range *b.AllowedBackends {
			names = append(names, string(n))
		}
		u.AllowedBackends = &names
	}
	v, ch, err := s.opts.Machines.UpdateSettings(ctx, s.actor(ctx), r.MachineId, u)
	if err != nil {
		return fail[gen.UpdateMachinedefaultJSONResponse](s, err), nil
	}
	if ch != nil {
		return gen.UpdateMachine202JSONResponse(changeToAPI(*ch)), nil
	}
	return gen.UpdateMachine200JSONResponse(machineToAPI(v, time.Now())), nil
}

// RemoveMachine implements DELETE /api/v1/machines/{machineId} (machines R5.40 to R5.42).
func (s *server) RemoveMachine(ctx context.Context, r gen.RemoveMachineRequestObject) (gen.RemoveMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.RemoveMachinedefaultJSONResponse](), nil
	}
	ch, err := s.opts.Machines.Remove(ctx, s.actor(ctx), r.MachineId, r.Params.Confirm != nil && *r.Params.Confirm)
	if err != nil {
		return fail[gen.RemoveMachinedefaultJSONResponse](s, err), nil
	}
	return gen.RemoveMachine202JSONResponse(changeToAPI(ch)), nil
}

// DrainMachine implements POST /api/v1/machines/{machineId}/drain.
func (s *server) DrainMachine(ctx context.Context, r gen.DrainMachineRequestObject) (gen.DrainMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.DrainMachinedefaultJSONResponse](), nil
	}
	reason := ""
	if r.Body != nil && r.Body.Reason != nil {
		reason = *r.Body.Reason
	}
	ch, err := s.opts.Machines.Drain(ctx, s.actor(ctx), r.MachineId, reason)
	if err != nil {
		return fail[gen.DrainMachinedefaultJSONResponse](s, err), nil
	}
	return gen.DrainMachine202JSONResponse(changeToAPI(ch)), nil
}

// ResumeMachine implements POST /api/v1/machines/{machineId}/resume.
func (s *server) ResumeMachine(ctx context.Context, r gen.ResumeMachineRequestObject) (gen.ResumeMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.ResumeMachinedefaultJSONResponse](), nil
	}
	v, err := s.opts.Machines.Resume(ctx, s.actor(ctx), r.MachineId, r.Params.Confirm != nil && *r.Params.Confirm)
	if err != nil {
		return fail[gen.ResumeMachinedefaultJSONResponse](s, err), nil
	}
	return gen.ResumeMachine200JSONResponse(machineToAPI(v, time.Now())), nil
}

// RedetectMachine implements POST /api/v1/machines/{machineId}/redetect (Check again, machines R5.13).
func (s *server) RedetectMachine(ctx context.Context, r gen.RedetectMachineRequestObject) (gen.RedetectMachineResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.RedetectMachinedefaultJSONResponse](), nil
	}
	if err := s.opts.Machines.Redetect(ctx, s.actor(ctx), r.MachineId); err != nil {
		return fail[gen.RedetectMachinedefaultJSONResponse](s, err), nil
	}
	return gen.RedetectMachine202Response{}, nil
}

// GetMachineLoad implements GET /api/v1/machines/{machineId}/load (machines R6.8).
func (s *server) GetMachineLoad(ctx context.Context, r gen.GetMachineLoadRequestObject) (gen.GetMachineLoadResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.GetMachineLoaddefaultJSONResponse](), nil
	}
	var from, to time.Time
	if r.Params.From != nil {
		from = *r.Params.From
	}
	if r.Params.To != nil {
		to = *r.Params.To
	}
	pts, err := s.opts.Machines.LoadHistory(ctx, r.MachineId, from, to)
	if err != nil {
		return fail[gen.GetMachineLoaddefaultJSONResponse](s, err), nil
	}
	out := gen.GetMachineLoad200JSONResponse{}
	out.Items = make([]struct {
		At        time.Time `json:"at"`
		CpuPct    *float32  `json:"cpu_pct,omitempty"`
		MemoryPct *float32  `json:"memory_pct,omitempty"`
	}, 0, len(pts))
	for _, p := range pts {
		item := struct {
			At        time.Time `json:"at"`
			CpuPct    *float32  `json:"cpu_pct,omitempty"`
			MemoryPct *float32  `json:"memory_pct,omitempty"`
		}{At: p.At}
		if p.MemoryPct != nil {
			item.MemoryPct = f32(*p.MemoryPct)
		}
		if p.CPUPct != nil {
			item.CpuPct = f32(*p.CPUPct)
		}
		out.Items = append(out.Items, item)
	}
	return out, nil
}

// GetMachineChange implements GET /api/v1/machines/{machineId}/changes/{changeId}.
func (s *server) GetMachineChange(ctx context.Context, r gen.GetMachineChangeRequestObject) (gen.GetMachineChangeResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.GetMachineChangedefaultJSONResponse](), nil
	}
	c, err := s.opts.Machines.GetChange(ctx, r.MachineId, r.ChangeId)
	if err != nil {
		return fail[gen.GetMachineChangedefaultJSONResponse](s, err), nil
	}
	return gen.GetMachineChange200JSONResponse(changeToAPI(c)), nil
}

// DecideMachineChange implements POST /api/v1/machines/{machineId}/changes/{changeId} (machines R5.33).
func (s *server) DecideMachineChange(ctx context.Context, r gen.DecideMachineChangeRequestObject) (gen.DecideMachineChangeResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.DecideMachineChangedefaultJSONResponse](), nil
	}
	if r.Body == nil {
		return fail[gen.DecideMachineChangedefaultJSONResponse](s, machines.ErrInvalid), nil
	}
	wait := 0
	if r.Body.WaitMinutes != nil {
		wait = *r.Body.WaitMinutes
	}
	c, err := s.opts.Machines.DecideChange(ctx, s.actor(ctx), r.MachineId, r.ChangeId, machines.Decision(r.Body.Decision), wait, r.Body.Confirm != nil && *r.Body.Confirm)
	if err != nil {
		return fail[gen.DecideMachineChangedefaultJSONResponse](s, err), nil
	}
	return gen.DecideMachineChange200JSONResponse(changeToAPI(c)), nil
}

// CreateJoinCode implements POST /api/v1/join-codes (machines R5.3 to R5.6).
func (s *server) CreateJoinCode(ctx context.Context, r gen.CreateJoinCodeRequestObject) (gen.CreateJoinCodeResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.CreateJoinCodedefaultJSONResponse](), nil
	}
	var ttl time.Duration
	if r.Body != nil && r.Body.TtlMinutes != nil {
		ttl = time.Duration(*r.Body.TtlMinutes) * time.Minute
	}
	c, err := s.opts.Machines.CreateJoinCode(ctx, s.actor(ctx), ttl)
	if err != nil {
		return fail[gen.CreateJoinCodedefaultJSONResponse](s, err), nil
	}
	return gen.CreateJoinCode201JSONResponse{
		Code: c.Code, JoinCode: codeToAPI(c.JoinCode, c.JoinCode.State(time.Now())), Commands: installToAPI(s.opts.Machines, c.Code),
	}, nil
}

// GetJoinCode implements GET /api/v1/join-codes/{joinCodeId}: the state, never the value.
func (s *server) GetJoinCode(ctx context.Context, r gen.GetJoinCodeRequestObject) (gen.GetJoinCodeResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.GetJoinCodedefaultJSONResponse](), nil
	}
	c, st, err := s.opts.Machines.GetJoinCode(ctx, r.JoinCodeId)
	if err != nil {
		return fail[gen.GetJoinCodedefaultJSONResponse](s, err), nil
	}
	return gen.GetJoinCode200JSONResponse(codeToAPI(c, st)), nil
}

// RevokeJoinCode implements DELETE /api/v1/join-codes/{joinCodeId}.
func (s *server) RevokeJoinCode(ctx context.Context, r gen.RevokeJoinCodeRequestObject) (gen.RevokeJoinCodeResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.RevokeJoinCodedefaultJSONResponse](), nil
	}
	if err := s.opts.Machines.RevokeJoinCode(ctx, s.actor(ctx), r.JoinCodeId); err != nil {
		return fail[gen.RevokeJoinCodedefaultJSONResponse](s, err), nil
	}
	return gen.RevokeJoinCode204Response{}, nil
}

// GetInstallCommand implements GET /api/v1/install-command: no join code in it.
func (s *server) GetInstallCommand(_ context.Context, _ gen.GetInstallCommandRequestObject) (gen.GetInstallCommandResponseObject, error) {
	if s.machinesOff() {
		return unavailable[gen.GetInstallCommanddefaultJSONResponse](), nil
	}
	return gen.GetInstallCommand200JSONResponse(installToAPI(s.opts.Machines, "")), nil
}

// GetCaCertificate implements GET /api/v1/ca.pem: the CA certificate, public data.
func (s *server) GetCaCertificate(_ context.Context, _ gen.GetCaCertificateRequestObject) (gen.GetCaCertificateResponseObject, error) {
	if s.opts.CA == nil {
		return unavailable[gen.GetCaCertificatedefaultJSONResponse](), nil
	}
	pem := s.opts.CA.CAPEM()
	return gen.GetCaCertificate200ApplicationxPemFileResponse{Body: bytes.NewReader(pem), ContentLength: int64(len(pem))}, nil
}
