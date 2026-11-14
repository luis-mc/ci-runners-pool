package runners

import (
	"context"
	"fmt"
	"sort"
	"sync"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

type memStore struct {
	mu      sync.Mutex
	runners map[string]Record
	plans   map[string]Plan
	events  []string
}

func newMemStore() *memStore {
	return &memStore{runners: map[string]Record{}, plans: map[string]Plan{}}
}

func (m *memStore) InsertRunner(_ context.Context, r Record) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.runners[r.ID] = r
	return nil
}
func (m *memStore) GetRunner(_ context.Context, id string) (Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.runners[id]
	if !ok {
		return Record{}, ErrNotFound
	}
	return r, nil
}
func (m *memStore) ListRunners(_ context.Context, f Filter) ([]Record, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	var out []Record
	for _, r := range m.runners {
		if f.MachineID != "" && r.MachineID != f.MachineID {
			continue
		}
		if f.Managed != nil && r.Managed != *f.Managed {
			continue
		}
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}
func (m *memStore) SetRunnerState(_ context.Context, id string, to State, detail string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r, ok := m.runners[id]
	if !ok {
		return ErrNotFound
	}
	m.events = append(m.events, fmt.Sprintf("%s %s->%s %s", id, r.State, to, detail))
	r.State = to
	m.runners[id] = r
	return nil
}
func (m *memStore) SetRunnerService(_ context.Context, id, svc, acct string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	r := m.runners[id]
	r.ServiceName, r.Account = svc, acct
	m.runners[id] = r
	return nil
}
func (m *memStore) SetRunnerRegistration(context.Context, string, int64, string) error { return nil }
func (m *memStore) DeleteRunner(_ context.Context, id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.runners, id)
	return nil
}
func (m *memStore) SavePlan(_ context.Context, p Plan) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	p.Steps = append([]Step(nil), p.Steps...)
	m.plans[p.ID] = p
	return nil
}
func (m *memStore) GetPlan(_ context.Context, id string) (Plan, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	p, ok := m.plans[id]
	if !ok {
		return Plan{}, ErrNotFound
	}
	p.Steps = append([]Step(nil), p.Steps...)
	return p, nil
}

type fakeMachines map[string]Machine

func (f fakeMachines) GetMachine(_ context.Context, id string) (Machine, error) {
	m, ok := f[id]
	if !ok {
		return Machine{}, ErrNotFound
	}
	return m, nil
}

type fakeResolver struct{}

func (fakeResolver) Resolve(_ context.Context, s Scope) (Target, error) {
	return Target{Scope: github.RunnerScope{Owner: "luis-mc", Repo: "demo"}, InstallationID: 7, URL: "https://github.com/luis-mc/demo"}, nil
}

type fakeGitHub struct {
	runners  []github.Runner
	listErr  error
	regCalls int
	rmCalls  int
	tokens   []string
}

func (g *fakeGitHub) CreateRegistrationToken(context.Context, int64, github.RunnerScope) (string, error) {
	g.regCalls++
	g.tokens = append(g.tokens, "REG-TOKEN-1")
	return "REG-TOKEN-1", nil
}
func (g *fakeGitHub) CreateRemoveToken(context.Context, int64, github.RunnerScope) (string, error) {
	g.rmCalls++
	g.tokens = append(g.tokens, "REMOVE-TOKEN-1")
	return "REMOVE-TOKEN-1", nil
}
func (g *fakeGitHub) ListRunners(context.Context, int64, github.RunnerScope) ([]github.Runner, error) {
	return g.runners, g.listErr
}

type fakeAgent struct {
	added   []backend.RunnerSpec
	cfgs    []backend.StartConfig
	removed []RemoveRequest
	stopped []string
	folders []string
	addErr  error
	rmErr   error
}

func (a *fakeAgent) AddRunner(_ context.Context, _ string, spec backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error) {
	a.added, a.cfgs = append(a.added, spec), append(a.cfgs, cfg)
	if a.addErr != nil {
		return backend.Handle{}, a.addErr
	}
	return backend.Handle{RunnerID: spec.ID, Ref: "actions.runner.luis-mc-demo." + spec.Name}, nil
}
func (a *fakeAgent) StopService(_ context.Context, _ string, svc string) error {
	a.stopped = append(a.stopped, svc)
	return nil
}
func (a *fakeAgent) RemoveRunner(_ context.Context, _ string, req RemoveRequest) error {
	if a.rmErr != nil {
		return a.rmErr
	}
	a.removed = append(a.removed, req)
	return nil
}
func (a *fakeAgent) DeleteFolder(_ context.Context, _ string, f string) error {
	a.folders = append(a.folders, f)
	return nil
}

type fakeAudit struct{ entries []string }

func (f *fakeAudit) Audit(_ context.Context, actor, action, machine, subject, detail string) {
	f.entries = append(f.entries, fmt.Sprintf("%s|%s|%s|%s|%s", actor, action, machine, subject, detail))
}
