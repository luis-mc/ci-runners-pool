package repos

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Config builds a Service.
type Config struct {
	Store    Store
	GitHub   GitHub
	Tokens   TokenSource
	Audit    Auditor
	Capacity Capacity
	// Light keeps the light runners; nil means none are kept.
	Light LightRunners
	// Fleet removes job runners of a repository that stops being served (CRSP82); nil means none.
	Fleet Fleet
	// Up says which OSes have a machine that is online and accepting jobs; nil
	// turns the hosted fallback off for the whole controller (R5.43).
	Up UpSource
	// FallbackGrace is how long no machine of an OS must have been up before an
	// opted-in repository falls back; 0 means DefaultFallbackGrace.
	FallbackGrace func() time.Duration
	Now           func() time.Time
	// OnProgress, when set, is called with the plan after each step and when
	// the plan ends or is stopped (the plan.progress event).
	OnProgress func(Plan)
}

// Service is the pool switch, policy, variables and runs-on check.
type Service struct {
	cfg Config

	mu     sync.Mutex
	admin  map[int64]map[int64]bool // user id -> repository id -> GitHub admin, from the last sync
	synced map[int64]time.Time
	etags  map[int64]map[string]string // repository id -> workflow path -> etag
	cache  map[int64]map[string][]byte // repository id -> workflow path -> content

	fb fallbackState

	stopMu  sync.Mutex
	stops   map[string]bool // plan id -> a stop was asked while it applies
	running map[string]bool // plan id -> ApplyPlan is running it in this process
}

// New returns a Service.
func New(cfg Config) *Service {
	if cfg.Now == nil {
		cfg.Now = time.Now
	}
	return &Service{cfg: cfg, admin: map[int64]map[int64]bool{}, synced: map[int64]time.Time{},
		etags: map[int64]map[string]string{}, cache: map[int64]map[string][]byte{}, stops: map[string]bool{}, running: map[string]bool{}, fb: newFallbackState()}
}

// SetLight sets who keeps the light runners. The wiring calls it once the
// runners service exists, which is after this one.
func (s *Service) SetLight(l LightRunners) { s.cfg.Light = l }

// ErrNotAdmin: the user lacks the GitHub admin permission on the repository.
type ErrNotAdmin struct{ Repo string }

func (e *ErrNotAdmin) Error() string {
	return fmt.Sprintf("you do not have admin rights on %s in GitHub", e.Repo)
}

// Is lets errors.Is(err, auth.ErrForbidden) match.
func (e *ErrNotAdmin) Is(target error) bool { return target == auth.ErrForbidden }

// Sync lists the installations and repositories the user can see through the
// App and keeps them in the store, with the user's admin flag (R5.17, R5.18).
// It needs the user's GitHub token from memory; without it the caller gets
// auth.ErrGitHubSessionExpired and the console asks for a new sign-in.
func (s *Service) Sync(ctx context.Context, p auth.Principal) error {
	if err := auth.Require(p, auth.RoleViewer); err != nil {
		return err
	}
	tok, err := s.cfg.Tokens.GitHubToken(p.UserID)
	if err != nil {
		return err
	}
	ins, err := s.cfg.GitHub.ListUserInstallations(ctx, tok)
	if err != nil {
		return err
	}
	flags := map[int64]bool{}
	for _, in := range ins {
		if err := s.cfg.Store.UpsertInstallation(ctx, toInstallation(in)); err != nil {
			return err
		}
		repos, err := s.cfg.GitHub.ListInstallationRepositories(ctx, tok, in.ID)
		if err != nil {
			return err
		}
		for _, r := range repos {
			if err := s.cfg.Store.UpsertRepository(ctx, toRepository(r, in.ID)); err != nil {
				return err
			}
			flags[r.ID] = r.Admin
		}
	}
	s.mu.Lock()
	s.admin[p.UserID], s.synced[p.UserID] = flags, s.cfg.Now()
	s.mu.Unlock()
	return nil
}

// LastSync is when the user's listing was last refreshed from GitHub.
func (s *Service) LastSync(userID int64) time.Time {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.synced[userID]
}

func toInstallation(i github.Installation) Installation {
	return Installation{ID: i.ID, AccountLogin: i.AccountLogin, AccountType: i.AccountType,
		Selection: i.RepositorySelection, Permissions: i.Permissions, Suspended: i.Suspended}
}

func toRepository(r github.Repository, installationID int64) Repository {
	return Repository{ID: r.ID, InstallationID: installationID, FullName: r.FullName, Owner: r.Owner, Name: r.Name,
		Visibility: r.Visibility, DefaultBranch: r.DefaultBranch, Archived: r.Archived}
}

// Installations lists the stored installations with the permissions they lack
// (R5.17, R5.24).
type InstallationView struct {
	Installation
	MissingPermissions []string
}

// Installations returns the known installations and what each lacks.
func (s *Service) Installations(ctx context.Context, p auth.Principal) ([]InstallationView, error) {
	if err := auth.Require(p, auth.RoleViewer); err != nil {
		return nil, err
	}
	ins, err := s.cfg.Store.ListInstallations(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]InstallationView, 0, len(ins))
	for _, i := range ins {
		out = append(out, InstallationView{Installation: i, MissingPermissions: github.MissingPermissions(i.Permissions)})
	}
	return out, nil
}

// RepositoryView is a repository with its policy, variables and the user's
// GitHub admin flag.
type RepositoryView struct {
	Repository
	Policy         Policy
	Variables      []ManagedVariable
	UserIsAdmin    bool
	FindingsFail   int
	FindingsWarn   int
	VariablesDrift bool
	// Routing is where the repository's jobs go now and why (R5.44).
	Routing Routing
}

func (s *Service) view(ctx context.Context, p auth.Principal, r Repository) (RepositoryView, error) {
	v := RepositoryView{Repository: r, Policy: DefaultPolicy()}
	if pol, err := s.cfg.Store.GetPolicy(ctx, r.ID); err == nil {
		v.Policy = pol
	} else if !errors.Is(err, auth.ErrNotFound) {
		return v, err
	}
	vars, err := s.cfg.Store.ListManagedVariables(ctx, r.ID)
	if err != nil {
		return v, err
	}
	v.Variables = vars
	for _, mv := range vars {
		if mv.Status != VarOK {
			v.VariablesDrift = true
		}
	}
	fs, _, err := s.cfg.Store.ListFindings(ctx, r.ID)
	if err != nil {
		return v, err
	}
	for _, f := range fs {
		if f.Severity() == SeverityFail {
			v.FindingsFail++
		} else {
			v.FindingsWarn++
		}
	}
	if rt, err := s.routing(ctx, r, v.Policy); err == nil {
		v.Routing = rt
	}
	s.mu.Lock()
	v.UserIsAdmin = s.admin[p.UserID][r.ID]
	s.mu.Unlock()
	return v, nil
}

// List returns one page of repositories from the store, after the last full
// name in f.AfterName. The listing was filled by Sync; the page's age is
// LastSync (R6.11).
func (s *Service) List(ctx context.Context, p auth.Principal, f ListFilter) ([]RepositoryView, error) {
	if err := auth.Require(p, auth.RoleViewer); err != nil {
		return nil, err
	}
	rs, err := s.cfg.Store.ListRepositories(ctx, f)
	if err != nil {
		return nil, err
	}
	out := make([]RepositoryView, 0, len(rs))
	for _, r := range rs {
		v, err := s.view(ctx, p, r)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, nil
}

// Get returns one repository view.
func (s *Service) Get(ctx context.Context, p auth.Principal, id int64) (RepositoryView, error) {
	if err := auth.Require(p, auth.RoleViewer); err != nil {
		return RepositoryView{}, err
	}
	r, err := s.cfg.Store.GetRepository(ctx, id)
	if err != nil {
		return RepositoryView{}, err
	}
	return s.view(ctx, p, r)
}

// requireGitHubAdmin reads the user's GitHub admin permission fresh, at the
// moment of the change (R5.19). With the user's own token it asks GitHub as the
// user; when that token is gone it asks as the App for the user's permission,
// which answers the same question. GitHub errors fail closed.
func (s *Service) requireGitHubAdmin(ctx context.Context, p auth.Principal, r Repository) error {
	if err := auth.Require(p, auth.RoleAdmin); err != nil {
		return err
	}
	if p.Source == "controller" {
		return nil
	}
	if tok, err := s.cfg.Tokens.GitHubToken(p.UserID); err == nil {
		ok, err := s.cfg.GitHub.UserCanAdmin(ctx, tok, r.Owner, r.Name)
		if err != nil {
			if errors.Is(err, github.ErrNotFound) || errors.Is(err, github.ErrForbidden) {
				return &ErrNotAdmin{Repo: r.FullName}
			}
			return err
		}
		if !ok {
			return &ErrNotAdmin{Repo: r.FullName}
		}
		return nil
	} else if !errors.Is(err, auth.ErrGitHubSessionExpired) {
		return err
	}
	perm, err := s.cfg.GitHub.CollaboratorPermission(ctx, r.InstallationID, r.Owner, r.Name, p.Login)
	if err != nil {
		if errors.Is(err, github.ErrNotFound) {
			return &ErrNotAdmin{Repo: r.FullName}
		}
		return err
	}
	if !strings.EqualFold(perm, "admin") {
		return &ErrNotAdmin{Repo: r.FullName}
	}
	return nil
}

// UpdatePolicy changes a repository's policy (R5.25 to R5.27). It needs the
// product role admin or owner and the GitHub admin permission, read fresh.
// Fork pull requests on ask for ConfirmForkRisk. Turning them off, or leaving
// them off, makes sure the repository's fork approval setting holds outside
// contributors' runs (R5.26). When the pool is on, the variables are
// rewritten and the runs-on check runs again.
func (s *Service) UpdatePolicy(ctx context.Context, p auth.Principal, id int64, u PolicyUpdate) (Policy, error) {
	r, err := s.cfg.Store.GetRepository(ctx, id)
	if err != nil {
		return Policy{}, err
	}
	if err := s.requireGitHubAdmin(ctx, p, r); err != nil {
		return Policy{}, err
	}
	old, err := s.policyOrDefault(ctx, id)
	if err != nil {
		return Policy{}, err
	}
	np, err := u.Apply(old)
	if err != nil {
		return Policy{}, err
	}
	if np.HostedFallback && r.Visibility == "public" {
		return Policy{}, auth.Invalid("%s is a public repository; crsp serves private repositories only, so it never runs on GitHub-hosted runners", r.FullName)
	}
	np.UpdatedAt, np.UpdatedBy = s.cfg.Now(), p.Login
	if r.PoolOn && !np.AllowForkPRs {
		if err := s.guardForks(ctx, r); err != nil {
			return Policy{}, err
		}
	}
	if err := s.cfg.Store.UpsertPolicy(ctx, id, np); err != nil {
		return Policy{}, err
	}
	s.cfg.Audit.Audit(ctx, p, "policy.changed", "repository", r.FullName, describePolicy(old, np))
	if !np.HostedFallback && s.dropFallback(id) {
		// Turned off while on fallback: the switch back is logged like any
		// other (R5.43); syncVariables below writes the crsp labels at once.
		s.cfg.Audit.Audit(ctx, p, "fallback.ended", "repository", r.FullName, "fallback was turned off for this repository")
	}
	if r.PoolOn {
		if err := s.syncVariables(ctx, p, r, np); err != nil {
			return np, err
		}
		if err := s.syncLight(ctx, p, r, np); err != nil {
			return np, err
		}
		_ = s.CheckRunsOn(ctx, id)
	}
	return np, nil
}

func (s *Service) policyOrDefault(ctx context.Context, id int64) (Policy, error) {
	pol, err := s.cfg.Store.GetPolicy(ctx, id)
	if errors.Is(err, auth.ErrNotFound) {
		return DefaultPolicy(), nil
	}
	return pol, err
}

// guardForks sets the fork approval setting on a public repository so that
// every outside contributor's run waits for approval (R5.26, guard one). The
// job-started hook is guard two.
func (s *Service) guardForks(ctx context.Context, r Repository) error {
	if r.Visibility != "public" {
		return nil
	}
	return s.cfg.GitHub.SetForkApproval(ctx, r.InstallationID, r.Owner, r.Name, github.ForkApprovalAllOutside)
}

func describePolicy(a, b Policy) string {
	var d []string
	if a.Priority != b.Priority {
		d = append(d, fmt.Sprintf("priority %d to %d", a.Priority, b.Priority))
	}
	if a.MaxParallelJobs != b.MaxParallelJobs {
		d = append(d, fmt.Sprintf("parallel %d to %d", a.MaxParallelJobs, b.MaxParallelJobs))
	}
	if a.AllowForkPRs != b.AllowForkPRs {
		d = append(d, fmt.Sprintf("fork pull requests %t to %t", a.AllowForkPRs, b.AllowForkPRs))
	}
	if strings.Join(a.Labels, ",") != strings.Join(b.Labels, ",") {
		d = append(d, "labels "+strings.Join(b.Labels, ","))
	}
	if strings.Join(a.RunnerGroups, ",") != strings.Join(b.RunnerGroups, ",") {
		d = append(d, "runner groups "+strings.Join(b.RunnerGroups, ","))
	}
	if strings.Join(a.ExtraPackages, ",") != strings.Join(b.ExtraPackages, ",") {
		d = append(d, "extra packages "+strings.Join(b.ExtraPackages, ","))
	}
	if a.LightRunner != b.LightRunner {
		d = append(d, fmt.Sprintf("light runner %t to %t", a.LightRunner, b.LightRunner))
	}
	if a.LegacyVars != b.LegacyVars {
		d = append(d, fmt.Sprintf("old variable names %t to %t", a.LegacyVars, b.LegacyVars))
	}
	if a.HostedFallback != b.HostedFallback {
		d = append(d, fmt.Sprintf("hosted fallback %t to %t", a.HostedFallback, b.HostedFallback))
	}
	if a.FallbackCapMinutes != b.FallbackCapMinutes {
		d = append(d, fmt.Sprintf("fallback cap %d to %d minutes", a.FallbackCapMinutes, b.FallbackCapMinutes))
	}
	if fmt.Sprint(a.HostedLabels) != fmt.Sprint(b.HostedLabels) {
		d = append(d, fmt.Sprintf("hosted labels %v", b.HostedLabels))
	}
	if a.BudgetMemoryPct != b.BudgetMemoryPct || a.BudgetCPUPct != b.BudgetCPUPct {
		d = append(d, "budget")
	}
	if len(d) == 0 {
		return "no change"
	}
	return strings.Join(d, "; ")
}
