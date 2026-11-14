package doctor

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Env is what a check may read (spec 7.1). Every source is read-only; a
// check never writes through it (R5.7).
type Env struct {
	// Now is the time of the run. Checks use it, never time.Now, so tests are exact.
	Now   time.Time
	Scope Scope
	Fleet Fleet
	// GitHub is nil when the App is not set up; GitHub checks then skip.
	GitHub GitHub
	// PoolName is the pool's name label; RunnerPrefix starts the name of every
	// runner the product makes (default "crsp-").
	PoolName     string
	RunnerPrefix string

	memo *memo
}

// DefaultRunnerPrefix starts the name of runners the product makes.
const DefaultRunnerPrefix = "crsp-"

// Prefix returns the runner name prefix in use.
func (e Env) Prefix() string {
	if e.RunnerPrefix != "" {
		return e.RunnerPrefix
	}
	return DefaultRunnerPrefix
}

type memoEntry struct {
	once sync.Once
	val  any
	err  error
}

type memo struct {
	mu sync.Mutex
	m  map[string]*memoEntry
}

// Memo runs fn once per key in one run and returns its result to every
// caller, so a full run reads each repository's variables, workflow files and
// runner list once (R6.2). Without a run (nil memo) it just calls fn.
func (e Env) Memo(key string, fn func() (any, error)) (any, error) {
	if e.memo == nil {
		return fn()
	}
	e.memo.mu.Lock()
	ent, ok := e.memo.m[key]
	if !ok {
		ent = &memoEntry{}
		e.memo.m[key] = ent
	}
	e.memo.mu.Unlock()
	ent.once.Do(func() { ent.val, ent.err = fn() })
	return ent.val, ent.err
}

// ErrUnreachable is returned by a source that could not be reached (an agent
// that is offline, GitHub that does not answer). A check turns it into skip (R5.5).
var ErrUnreachable = errors.New("unreachable")

// GitHub is the part of the GitHub adapter the doctor reads with.
type GitHub interface {
	GetApp(ctx context.Context) (github.App, error)
	GetInstallation(ctx context.Context, installationID int64) (github.Installation, error)
	ListRunners(ctx context.Context, installationID int64, scope github.RunnerScope) ([]github.Runner, error)
	ListVariables(ctx context.Context, installationID int64, owner, repo string) ([]github.Variable, error)
	ListWorkflowFiles(ctx context.Context, installationID int64, owner, repo string, etags map[string]string) ([]github.WorkflowFile, error)
}

// Fleet is the controller's own data: machines, runners and repositories.
type Fleet interface {
	Machines(ctx context.Context) ([]Machine, error)
	// Runners lists the runners the product manages, from the database.
	Runners(ctx context.Context) ([]Runner, error)
	// Services lists the runner services found in the OS service list of a
	// machine, asked from its agent (R5.11). ErrUnreachable when the agent does not answer.
	Services(ctx context.Context, machineID string) ([]OSService, error)
	// Repositories lists repositories that have the pool on.
	Repositories(ctx context.Context) ([]Repository, error)
}

// Machine is a machine as the checks need it.
type Machine struct {
	ID, Name, OS string
	Online       bool
	LastSeen     time.Time
	// State is active, drained, draining or removing.
	State string
	// Load is nil when no sample exists yet.
	Load *Load
	// BudgetMemoryPct and BudgetCPUPct are the machine's load budget.
	BudgetMemoryPct, BudgetCPUPct int
	// OverBudgetSince is when the load went over the budget and stayed; zero when under it.
	OverBudgetSince time.Time
	// DiskFreeBytes and DiskTotalBytes describe the work volume; nil when unknown.
	DiskFreeBytes, DiskTotalBytes *int64
	// Admin is true when the doctor on this machine runs with administrator
	// rights, for checks that need them (R5.13). Reported by the agent.
	Admin bool
	// LightSlots is the machine's light slot setting (scheduling R5.1).
	LightSlots int
}

// Load is the newest load sample.
type Load struct {
	MemoryPct, CPUPct float64
	MemoryKnown       bool
	CPUKnown          bool
	SampledAt         time.Time
}

// Runner is a runner the product manages.
type Runner struct {
	ID, Name    string
	MachineID   string
	MachineName string
	OS          string
	Kind        string // persistent or ephemeral
	// Labels are the labels the runner carries.
	Labels []string
	// GitHubRunnerID is set once registered.
	GitHubRunnerID int64
	// ServiceName is the OS service name of a persistent runner.
	ServiceName string
	// InstallationID and Scope say where it registered.
	InstallationID int64
	Scope          github.RunnerScope
	// FolderReadable is false when the agent could not read the runner folder
	// (it is locked to the runner's account, R5.13).
	FolderReadable bool
	// HookProblems lists problems with the job hooks found by the agent: a
	// missing hook, a .cmd hook, one in a user profile (R5.14). Empty is fine.
	HookProblems []string
	// HookProbe is what the agent saw when it ran the runner's job-started hook
	// as the service account in probe mode; nil when it did not run it (R5.29).
	HookProbe *HookProbe
	// ListenerKnown is true when the agent looked for the runner's listener
	// processes (Runner.Listener started from the runner folder). ListenerPIDs
	// are their process ids; ServiceRunning is the service state (R5.30).
	ListenerKnown  bool
	ListenerPIDs   []int
	ServiceRunning bool
	// ToolCache is what the agent saw in the runner's tool cache; nil when it
	// did not look (R5.35).
	ToolCache *ToolCacheProbe
}

// ToolCacheProbe is what the agent found in a runner's tool cache (_work/_tool
// or the configured tool cache folder), seen as the runner's account.
type ToolCacheProbe struct {
	// Dir is the folder that was looked at.
	Dir string
	// Err is set when the account could not read a file there (for example
	// "Access is denied"). File is the file that failed.
	Err  string
	File string
	// OwnerKnown is true when the agent read the owner and inheritance of the
	// files instead of opening one. WrongOwner lists files whose owner is not
	// the runner account; NotInherited lists files with inheritance off.
	OwnerKnown   bool
	WrongOwner   []string
	NotInherited []string
}

// HookProbe is the result of one run of a runner's real job-started hook script
// as the runner's service account, with CRSP_HOOK_PROBE=1, so the probe takes
// no slot and starts no job (R5.29).
type HookProbe struct {
	// Err is set when the script could not be started at all (no PowerShell,
	// no /bin/sh, a script the account may not read or run).
	Err      string
	ExitCode int
	// Output is what the script printed, secrets removed by the redactor.
	Output string
}

// OSService is one runner service from the OS service list (R5.11).
type OSService struct {
	// Name is the service, unit or launchd label, such as "actions.runner.org-repo.name".
	Name string
	// RunnerName is the runner name parsed from Name.
	RunnerName string
	// Scope is "owner-repo" or the organization, parsed from Name.
	Scope string
	// Running is true when the service runs now.
	Running bool
	// Automatic is true when it starts with the machine. AutomaticKnown is
	// false when the OS did not say.
	Automatic      bool
	AutomaticKnown bool
}

// Repository is a repository with the pool on.
type Repository struct {
	ID             int64
	FullName       string
	Owner, Name    string
	InstallationID int64
	// DefaultBranch is where the workflows are read from.
	DefaultBranch string
	// Expected holds the value the product would write for each variable,
	// keyed by variable name, for OSes the policy enables. A JSON list.
	Expected map[string]string
	// LightRunner is true when the repository's policy keeps a light runner
	// for it (scheduling R5.65).
	LightRunner bool
}

// InScopeMachine is a helper for checks.
func (e Env) InScopeMachine(m Machine) bool { return e.Scope.MatchMachine(m.ID, m.Name) }

// InScopeRepository is a helper for checks.
func (e Env) InScopeRepository(r Repository) bool { return e.Scope.MatchRepository(r.ID) }
