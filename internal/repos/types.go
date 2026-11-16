// Package repos is the pool switch, repository policy, the RUNS_ON_*
// variables and the workflow runs-on check (github-integration R5.17 to
// R5.30). It reads and writes data through the Store interface declared here
// and reaches GitHub through the small GitHub interface, so it is tested with
// the fake GitHub server (R6.9).
package repos

import (
	"context"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Repository is one repository of an installation, with its pool state.
type Repository struct {
	ID             int64
	InstallationID int64
	FullName       string
	Owner          string
	Name           string
	Visibility     string
	DefaultBranch  string
	Archived       bool
	PoolOn         bool
	PoolChangedAt  time.Time
	PoolChangedBy  string
	// LeftAt is when the repository was last seen to have left its
	// installation (the owner removed it from the App, or the installation went
	// away); zero while it is in. A left repository is hidden from listings
	// unless ListFilter.IncludeLeft is set (CRSP125); the repositories screen
	// shows why from this field.
	LeftAt time.Time
}

// Policy is a repository's policy (R5.25).
type Policy struct {
	Priority        int
	MaxParallelJobs int
	AllowForkPRs    bool
	Labels          []string
	RunnerGroups    []string
	BudgetMemoryPct int // 0 means not set
	BudgetCPUPct    int // 0 means not set
	// LightRunner keeps one light runner per OS for the repository and writes
	// RUNS_ON_LIGHT (scheduling R5.65). On by default.
	LightRunner bool
	// LegacyVars also writes CI_RUNS_ON and CI_RUNS_ON_WINDOWS, the old
	// dev-standards names, while a repository moves off the old pool (R5.39).
	// Off by default.
	LegacyVars bool
	// ExtraPackages are the extra distribution packages of the pool image,
	// sorted, without repeats (runners R5.51). Empty adds no layer.
	ExtraPackages []string
	// HostedFallback runs the repository's jobs on GitHub-hosted runners while
	// no crsp machine can take them. Off by default: jobs wait for a crsp
	// machine, which costs nothing (github-integration R5.42).
	HostedFallback bool
	// FallbackCapMinutes caps the fallback minutes of a calendar month (UTC).
	// 0 means no cap.
	FallbackCapMinutes int
	// HostedLabels is the hosted label per OS ("linux", "windows", "macos");
	// a missing OS uses DefaultHostedLabels.
	HostedLabels map[string]string
	UpdatedAt    time.Time
	UpdatedBy    string
}

// DefaultPolicy is what a repository gets when the pool is first turned on:
// normal priority, 2 parallel jobs, fork pull requests off (R5.25, R5.26).
func DefaultPolicy() Policy {
	return Policy{Priority: 0, MaxParallelJobs: 2, Labels: []string{}, RunnerGroups: []string{}, LightRunner: true}
}

// Variable statuses (R5.28).
const (
	VarOK         = "ok"
	VarMissing    = "missing"
	VarWrong      = "wrong"
	VarNotManaged = "not_managed"
)

// VarLight is the variable that names the light runner label (scheduling
// R5.65). Its value is the plain label LightValue, not a JSON list, so a
// workflow reads it as `runs-on: ${{ vars.RUNS_ON_LIGHT }}`.
const (
	VarLight   = "RUNS_ON_LIGHT"
	LightValue = "crsp-light"
)

// ManagedVariable is a RUNS_ON_* variable as the controller last wrote it.
type ManagedVariable struct {
	RepositoryID int64
	Name         string
	Value        string
	Status       string
	WrittenAt    time.Time
	CheckedAt    time.Time
}

// Finding kinds of the runs-on check (R5.30).
const (
	KindNoRunner    = "no_runner_with_labels" // fail
	KindNotGeneric  = "not_generic"           // warning: literal labels instead of the variable
	KindUsesVar     = "uses_variable"         // fail: the variable the workflow reads is not set
	KindHosted      = "hosted"                // not stored
	SeverityFail    = "fail"
	SeverityWarning = "warning"
)

// Finding is one runs-on finding with file and line.
type Finding struct {
	RepositoryID int64
	Path         string
	Line         int
	Labels       []string
	Kind         string
	Text         string
}

// Severity is fail or warning, from the kind.
func (f Finding) Severity() string {
	if f.Kind == KindNotGeneric {
		return SeverityWarning
	}
	return SeverityFail
}

// Plan step actions (the OpenAPI PlanStep enum).
const (
	ActPoolOn         = "pool_on"
	ActPoolOff        = "pool_off"
	ActWriteVariable  = "write_variable"
	ActDeleteVariable = "delete_variable"
)

// Step states.
const (
	StepPlanned = "planned"
	StepRunning = "running"
	StepDone    = "done"
	StepFailed  = "failed"
	StepSkipped = "skipped"
)

// Plan states.
const (
	PlanPlanned  = "planned"
	PlanApplying = "applying"
	PlanDone     = "done"
	PlanFailed   = "failed"
	PlanStale    = "stale"
	PlanStopped  = "stopped"
)

// Step is one thing a plan does.
type Step struct {
	ID       string `json:"id"`
	Action   string `json:"action"`
	Target   string `json:"target,omitempty"`
	Text     string `json:"text"`
	NeedsYes bool   `json:"needs_yes"`
	State    string `json:"state"`
	Error    string `json:"error,omitempty"`
	// RepositoryID ties the step to its repository.
	RepositoryID int64 `json:"repository_id"`
	// Pool is the wanted pool state of a pool_on or pool_off step.
	Pool bool `json:"pool,omitempty"`
	// Value is what a write_variable step writes.
	Value string `json:"value,omitempty"`
}

// Plan is a planned change. Nothing changes until it is applied (R5.20).
type Plan struct {
	ID        string
	State     string
	StateHash string
	Steps     []Step
	CreatedBy string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Installation is a stored installation.
type Installation struct {
	ID           int64
	AccountLogin string
	AccountType  string
	Selection    string
	Permissions  map[string]string
	Suspended    bool
	Removed      bool
}

// ListFilter filters ListRepositories; results are ordered by full name.
type ListFilter struct {
	InstallationID int64
	Pool           *bool
	Query          string
	AfterName      string
	Limit          int
	// IncludeLeft also returns repositories that left their installation.
	IncludeLeft bool
}

// Store is the data this package needs. MemStore is the in-memory
// implementation; the SQL adapter lives with the database package.
type Store interface {
	UpsertInstallation(ctx context.Context, i Installation) error
	MarkInstallationRemoved(ctx context.Context, id int64) error
	ListInstallations(ctx context.Context) ([]Installation, error)

	// UpsertRepository keeps the pool state of an existing row.
	UpsertRepository(ctx context.Context, r Repository) error
	GetRepository(ctx context.Context, id int64) (Repository, error)
	ListRepositories(ctx context.Context, f ListFilter) ([]Repository, error)
	SetRepositoryPool(ctx context.Context, id int64, on bool, by string, at time.Time) error
	// SetRepositoryLeft marks a repository as out of its installation at the
	// given time; a zero time clears the mark. UpsertRepository clears it too.
	SetRepositoryLeft(ctx context.Context, id int64, at time.Time) error

	GetPolicy(ctx context.Context, repoID int64) (Policy, error)
	UpsertPolicy(ctx context.Context, repoID int64, p Policy) error

	ListManagedVariables(ctx context.Context, repoID int64) ([]ManagedVariable, error)
	UpsertManagedVariable(ctx context.Context, v ManagedVariable) error
	SetManagedVariableStatus(ctx context.Context, repoID int64, name, status string, at time.Time) error
	DeleteManagedVariable(ctx context.Context, repoID int64, name string) error

	ReplaceFindings(ctx context.Context, repoID int64, fs []Finding, at time.Time) error
	ListFindings(ctx context.Context, repoID int64) ([]Finding, time.Time, error)

	// FallbackSeconds is the seconds a repository's jobs ran on the hosted
	// label in a month ("2026-11"); AddFallbackSeconds adds to it (R5.43).
	FallbackSeconds(ctx context.Context, repoID int64, month string) (int64, error)
	AddFallbackSeconds(ctx context.Context, repoID int64, month string, seconds int64) error

	InsertPlan(ctx context.Context, p Plan) error
	GetPlan(ctx context.Context, id string) (Plan, error)
	UpdatePlan(ctx context.Context, p Plan) error
}

// GitHub is what repos needs from the GitHub adapter.
type GitHub interface {
	ListUserInstallations(ctx context.Context, tok github.UserToken) ([]github.Installation, error)
	ListInstallationRepositories(ctx context.Context, tok github.UserToken, installationID int64) ([]github.Repository, error)
	UserCanAdmin(ctx context.Context, tok github.UserToken, owner, repo string) (bool, error)
	CollaboratorPermission(ctx context.Context, installationID int64, owner, repo, login string) (string, error)
	ListAppInstallations(ctx context.Context) ([]github.Installation, error)
	ListAppRepositories(ctx context.Context, installationID int64) ([]github.Repository, error)
	ListVariables(ctx context.Context, installationID int64, owner, repo string) ([]github.Variable, error)
	SetVariable(ctx context.Context, installationID int64, owner, repo string, v github.Variable) error
	DeleteVariable(ctx context.Context, installationID int64, owner, repo, name string) error
	ListWorkflowFiles(ctx context.Context, installationID int64, owner, repo string, etags map[string]string) ([]github.WorkflowFile, error)
	SetForkApproval(ctx context.Context, installationID int64, owner, repo, policy string) error
	ListOpenJobs(ctx context.Context, installationID int64, owner, repo string) ([]github.Job, error)
}

// LightRunners keeps the light runners of a repository (scheduling R5.65).
// The runners service implements it through an adapter.
type LightRunners interface {
	// EnsureLight keeps one light runner for each OS in oses ("linux",
	// "windows", "macos"). It returns how many OSes have one, and one note
	// for each OS that has none, with the reason.
	EnsureLight(ctx context.Context, r Repository, oses []string, actor string) (have int, notes []string, err error)
	// RemoveLight removes the light runners of the repository after their jobs end.
	RemoveLight(ctx context.Context, r Repository, actor string) error
}

// TokenSource gives the GitHub user token of a signed-in user, from memory.
type TokenSource interface {
	GitHubToken(userID int64) (github.UserToken, error)
}

// Auditor writes the audit log (R5.16). auth.Service implements it.
type Auditor interface {
	Audit(ctx context.Context, p auth.Principal, action, targetType, subject, detail string)
}

// Capacity says which operating systems some machine can serve, and the
// labels that machines carry for each (R5.28). The key is "Linux", "Windows"
// or "macOS"; a missing key means no machine serves that OS.
type Capacity interface {
	OSLabels(ctx context.Context) (map[string][]string, error)
}

// UpSource says, per OS, whether some crsp machine can take jobs now: online
// on the agent link and accepting jobs (not paused, not on battery). The key
// is "Linux", "Windows" or "macOS"; an OS that has no machine is absent
// (github-integration R5.43).
type UpSource interface {
	UpOS(ctx context.Context) (map[string]bool, error)
}

// System is the principal for background work.
var System = auth.Principal{UserID: 0, Login: "controller", Role: auth.RoleOwner, Source: "controller"}
