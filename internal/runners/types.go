package runners

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/poolsize"
)

// Scope is where a runner registers (runners R5.2).
type Scope struct {
	Kind         string // repository or organization
	RepositoryID int64
	Organization string
	Group        string
}

// Record is the runner record (runners R5.2). It has no token or password.
type Record struct {
	ID             string
	Name           string
	MachineID      string
	OS             string
	Arch           string
	Kind           string // persistent or ephemeral
	Backend        string
	Isolation      string
	Labels         []string
	Scope          Scope
	RunnerVersion  string
	State          State
	Managed        bool
	ServiceName    string
	Account        string
	Folder         string
	GitHubRunnerID int64
	CurrentJob     string // empty when none
	CreatedAt      time.Time
}

// KeepsState is true for a persistent runner (runners R5.7).
func (r Record) KeepsState() bool { return r.Kind == "persistent" }

// Filter narrows a runner list.
type Filter struct {
	MachineID string
	OS        string
	State     string
	Managed   *bool
}

// BackendOption is what a machine's agent reports for one backend and whether
// the user allowed it (machines R5.11, runners R5.9).
type BackendOption struct {
	Name     backend.Name
	Usable   bool
	Allowed  bool
	Reason   string
	Kinds    []string
	OS       []string
	Verified []string // capability labels the agent checked
}

// Machine is the part of a machine the runner rules need.
type Machine struct {
	ID       string
	Name     string
	OS       string
	Arch     string
	Backends []BackendOption
	Symlink  bool // a machine or label setting asks for the symlink right (R5.14)
	// PoolCPUs and JobSlots are the owner's pool size and the runners that run
	// at once; a runner's CPU count is their split (machines R5.54, R5.58).
	// PoolCPUs 0 means no pool size is set and no CPU count is exported.
	PoolCPUs int
	JobSlots int
	// PoolMemoryGiB is the owner's pool memory. With PoolCPUs it becomes the
	// limits of the pool container of each repository (runners R5.27).
	PoolMemoryGiB float64
}

// MaxParallel is the CPU count a runner on this machine gives its jobs, or 0
// when the owner has set no pool size (runners R5.53).
func (m Machine) MaxParallel() int {
	if m.PoolCPUs <= 0 {
		return 0
	}
	return poolsize.PerRunner(m.PoolCPUs, m.JobSlots)
}

// PlanState and step states mirror the API enums.
const (
	PlanPlanned  = "planned"
	PlanApplying = "applying"
	PlanDone     = "done"
	PlanFailed   = "failed"
	PlanStopped  = "stopped"
)

// Step actions (the runner ones of the API enum).
const (
	ActAddRunner       = "add_runner"
	ActStopOldService  = "stop_old_service"
	ActRemoveOldRunner = "remove_old_runner"
	ActDeleteOldFolder = "delete_old_folder"
)

// Step is one named change. A step that deletes needs its own yes (UX-62).
type Step struct {
	ID       string
	Action   string
	Text     string
	Target   string
	NeedsYes bool
	WaitsFor string
	State    string // planned, running, done, failed, skipped, waiting
	Error    string
}

// AddSpec is one runner to add, kept with the plan. It has no token.
type AddSpec struct {
	Name      string
	MachineID string
	OS        string
	Arch      string
	Kind      string
	Backend   string
	Labels    []string
	Scope     Scope
	Symlink   bool
	// MaxParallel is CI_MAX_PARALLEL for the runner's jobs; 0 sets none.
	MaxParallel int
}

// Plan is a planned change. Nothing changes until it is applied.
type Plan struct {
	ID        string
	Area      string
	State     string
	CreatedAt time.Time
	CreatedBy string
	Steps     []Step
	Adds      []AddSpec
	// OldRunnerID is the runner a replacement removes.
	OldRunnerID string
}

// Store keeps runner records and plans.
type Store interface {
	InsertRunner(ctx context.Context, r Record) error
	GetRunner(ctx context.Context, id string) (Record, error)
	ListRunners(ctx context.Context, f Filter) ([]Record, error)
	SetRunnerState(ctx context.Context, id string, to State, detail string) error
	SetRunnerService(ctx context.Context, id, serviceName, account string) error
	SetRunnerRegistration(ctx context.Context, id string, githubRunnerID int64, version string) error
	DeleteRunner(ctx context.Context, id string) error
	SavePlan(ctx context.Context, p Plan) error
	GetPlan(ctx context.Context, id string) (Plan, error)
}

// ErrNotFound is returned by a Store and the Service for a missing runner or plan.
var ErrNotFound = errors.New("not found")

// Machines gives the machine facts.
type Machines interface {
	GetMachine(ctx context.Context, id string) (Machine, error)
}

// Resolver turns a scope into what GitHub calls need.
type Resolver interface {
	Resolve(ctx context.Context, s Scope) (Target, error)
}

// Target is a resolved scope.
type Target struct {
	Scope          github.RunnerScope
	InstallationID int64
	URL            string // https://github.com/<owner>[/<repo>]
	Group          string
}

// GitHub is the part of the GitHub adapter the runner flows use. Tokens are
// fetched right before use and dropped (runners R6.2).
type GitHub interface {
	CreateRegistrationToken(ctx context.Context, installationID int64, scope github.RunnerScope) (string, error)
	CreateRemoveToken(ctx context.Context, installationID int64, scope github.RunnerScope) (string, error)
	ListRunners(ctx context.Context, installationID int64, scope github.RunnerScope) ([]github.Runner, error)
	// GenerateJITConfig gives the config of one ephemeral runner (runners
	// R5.25, github-integration R5.34). The caller passes it on and drops it.
	GenerateJITConfig(ctx context.Context, installationID int64, scope github.RunnerScope, in github.JITRequest) (github.JITConfig, error)
}

// RemoveRequest asks an agent to take a runner away.
type RemoveRequest struct {
	RunnerID    string
	ServiceName string
	// RemoveToken deregisters the runner from GitHub; used once.
	RemoveToken string
	// KeepFiles deregisters only: the service entry, account and folder stay
	// until a later step with its own yes (a replace, runners R5.6).
	KeepFiles bool
}

// Agent is what the controller needs from a machine's agent, through the agent
// link (decision 0004). The link adapter maps each call to its message.
type Agent interface {
	AddRunner(ctx context.Context, machineID string, spec backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error)
	// StopService stops a service without removing anything.
	StopService(ctx context.Context, machineID, serviceName string) error
	// RemoveRunner deregisters the runner with the remove token and checks the
	// result. Unless KeepFiles is set it then cleans up: the service, the
	// account and the folder.
	RemoveRunner(ctx context.Context, machineID string, req RemoveRequest) error
	// CleanUp deletes the service entry, the account and the folder of a
	// runner (the last replace step, with its own yes).
	CleanUp(ctx context.Context, machineID, serviceName string) error
}

// Auditor writes the audit entry of every add, remove and replace (R6.8).
type Auditor interface {
	Audit(ctx context.Context, actor, action, machineID, subject, detail string)
}

// RefusalError is a request the controller refuses with a reason.
type RefusalError struct{ Reason string }

func (e *RefusalError) Error() string { return e.Reason }

// ConfirmItem is one thing a removal takes away.
type ConfirmItem struct{ Kind, Text string }

// NeedsConfirmation asks for a yes that names each item that goes and the job
// the removal waits for (UX-62, runners R5.4).
type NeedsConfirmation struct {
	Items []ConfirmItem
}

func (e *NeedsConfirmation) Error() string { return "this removal needs a yes" }

// OSName is the display name of an OS.
func OSName(os string) string {
	switch os {
	case "windows":
		return "Windows"
	case "macos":
		return "macOS"
	case "linux":
		return "Linux"
	}
	return os
}

func refuse(format string, a ...any) error { return &RefusalError{Reason: fmt.Sprintf(format, a...)} }
