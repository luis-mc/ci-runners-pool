package runners

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
)

// LightLabel is the label of a light runner (scheduling R5.65). A job that
// asks for it runs on a light runner, which holds a light slot only.
const LightLabel = "crsp-light"

// LightNamePrefix starts the name of every new light runner, so a person can
// tell one in a list. Nothing reads it back: routing uses the record's Route
// (runners R5.70).
const LightNamePrefix = "crsp-light-"

// IsLightRecord reports whether a record is a light runner, by its route.
func IsLightRecord(r Record) bool { return RouteOf(r).Light() }

// LightHost is a machine that may host a light runner: it is online, serves
// the OS and has light slots above 0.
type LightHost struct {
	MachineID  string
	LightSlots int
}

// LightPlacer lists the machines that can host a light runner for an OS.
type LightPlacer interface {
	LightHosts(ctx context.Context, os string) ([]LightHost, error)
}

// LightResult is what EnsureLight did for one OS.
type LightResult struct {
	OS string
	// Runner is the light runner now kept for the OS; empty when none could be placed.
	Runner string
	// Added is true when this call made it.
	Added bool
	// Why says why no light runner was placed.
	Why string
}

// lightRunners lists the managed light runners of a repository.
func (s *Service) lightRunners(ctx context.Context, repoID int64) ([]Record, error) {
	all, err := s.Store.ListRunners(ctx, Filter{})
	if err != nil {
		return nil, err
	}
	var out []Record
	for _, r := range all {
		if r.Managed && IsLightRecord(r) && r.Scope.RepositoryID == repoID {
			out = append(out, r)
		}
	}
	return out, nil
}

// LightRunners returns the light runners of a repository.
func (s *Service) LightRunners(ctx context.Context, repoID int64) ([]Record, error) {
	return s.lightRunners(ctx, repoID)
}

// LightMaxTries is how many times a failed light runner is tried again before
// the loop waits for a person to remove it.
const LightMaxTries = 5

// lightTry is what the loop remembers about the failed light runner of one
// repository and OS.
//
// It is kept when an attempt is rolled back and leaves no failed record, so
// the count survives the ticks: a light runner that cannot start is tried
// LightMaxTries times and then left alone (scheduling R5.65).
type lightTry struct {
	repoID int64
	os     string
	tries  int
	next   time.Time
	reason string // why the last try failed
	hosts  string // the machines that had a light slot at the last try
}

// LightStop is a light runner the loop gave up on: LightMaxTries tries failed.
// The doctor and the Runners note show Reason.
type LightStop struct {
	RepoID int64
	OS     string
	Tries  int
	Reason string
}

// LightStops lists the repository and OS pairs whose light runner the loop no
// longer tries.
func (s *Service) LightStops() []LightStop {
	s.lightTryMu.Lock()
	defer s.lightTryMu.Unlock()
	var out []LightStop
	for _, t := range s.lightTry {
		if t.tries >= LightMaxTries {
			out = append(out, LightStop{RepoID: t.repoID, OS: t.os, Tries: t.tries, Reason: t.reason})
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].RepoID != out[j].RepoID {
			return out[i].RepoID < out[j].RepoID
		}
		return out[i].OS < out[j].OS
	})
	return out
}

// ResetLightTries makes the loop try the light runner of a repository again
// at the next check: a person removed the failed runner or asked to try again.
func (s *Service) ResetLightTries(repoID int64) {
	s.lightTryMu.Lock()
	defer s.lightTryMu.Unlock()
	for k, t := range s.lightTry {
		if t.repoID == repoID {
			delete(s.lightTry, k)
		}
	}
}

func (s *Service) getTry(key string) lightTry {
	s.lightTryMu.Lock()
	defer s.lightTryMu.Unlock()
	return s.lightTry[key]
}

// setTry stores the tries of a key; nil forgets them.
func (s *Service) setTry(key string, t *lightTry) {
	s.lightTryMu.Lock()
	defer s.lightTryMu.Unlock()
	if t == nil {
		delete(s.lightTry, key)
		return
	}
	if s.lightTry == nil {
		s.lightTry = map[string]lightTry{}
	}
	s.lightTry[key] = *t
}

// lightHostsKey names the machines that offer a light slot for the OS, so a
// change of machines (one came, one left) starts the count again.
func (s *Service) lightHostsKey(ctx context.Context, os string) string {
	hosts, err := s.Light.LightHosts(ctx, os)
	if err != nil {
		return ""
	}
	ids := make([]string, 0, len(hosts))
	for _, h := range hosts {
		if h.LightSlots > 0 {
			ids = append(ids, h.MachineID)
		}
	}
	sort.Strings(ids)
	return strings.Join(ids, ",")
}

func lightKey(repoID int64, os string) string { return fmt.Sprintf("%d|%s", repoID, os) }

// lightBackoff is the wait after the n-th failed try: 1, 2, 4, 8, 16 minutes.
func lightBackoff(n int) time.Duration {
	if n < 1 {
		n = 1
	}
	if n > 5 {
		n = 5
	}
	return time.Minute << (n - 1)
}

// EnsureLight keeps one light runner for the repository for each OS in oses,
// on a machine with light slots (scheduling R5.65). An OS that already has
// one is left alone. An OS without a machine that can host one is reported
// with its reason, not as an error.
//
// A repository keeps at most one light runner record per OS. When it has
// failed, the loop tries again after a backoff, up to LightMaxTries times:
// before each new try it takes away what the failed one left (its
// registration, its service and its record), so the name is free again. The
// reason of the failure and the next try are in the result (UX-19).
func (s *Service) EnsureLight(ctx context.Context, repoID int64, repoName string, oses []string, actor string) ([]LightResult, error) {
	if s.Light == nil {
		return nil, errors.New("light runners are not set up")
	}
	s.lightMu.Lock()
	defer s.lightMu.Unlock()
	have, err := s.lightRunners(ctx, repoID)
	if err != nil {
		return nil, err
	}
	var out []LightResult
	var errs []error
	for _, os := range oses {
		res, err := s.ensureLightOS(ctx, have, repoID, repoName, os, actor)
		if err != nil {
			errs = append(errs, fmt.Errorf("light runner for %s: %w", OSName(os), err))
		}
		out = append(out, res)
	}
	return out, errors.Join(errs...)
}

func (s *Service) ensureLightOS(ctx context.Context, have []Record, repoID int64, repoName, os, actor string) (LightResult, error) {
	res := LightResult{OS: os}
	key := lightKey(repoID, os)
	var live, failed []Record
	for _, r := range have {
		switch {
		case r.OS != os:
		case r.State == Failed:
			failed = append(failed, r)
		default:
			live = append(live, r)
		}
	}
	sort.SliceStable(failed, func(i, j int) bool { return failed[i].CreatedAt.Before(failed[j].CreatedAt) })
	var errs []error
	if len(live) > 0 {
		// A working runner is all the repository needs: failed leftovers go.
		res.Runner = live[0].Name
		s.setTry(key, nil)
		for _, f := range failed {
			if err := s.discardFailed(ctx, f, actor, "light.failed_removed"); err != nil {
				errs = append(errs, err)
			}
		}
		return res, errors.Join(errs...)
	}
	hosts := s.lightHostsKey(ctx, os)
	t := s.getTry(key)
	if t.tries > 0 && t.hosts != hosts {
		s.setTry(key, nil) // the machines changed: start counting again
		t = lightTry{}
	}
	for _, f := range failed[min(1, len(failed)):] {
		if err := s.discardFailed(ctx, f, actor, "light.failed_removed"); err != nil {
			errs = append(errs, err)
		}
	}
	// The reason of the failure: the failed record's, or the one kept from an
	// attempt that was rolled back and left no record.
	reason := t.reason
	if len(failed) > 0 && failed[0].Reason != "" {
		reason = failed[0].Reason
	}
	what := "the light runner of " + OSName(os)
	if len(failed) > 0 {
		what = "light runner " + failed[0].Name
	}
	if t.tries >= LightMaxTries {
		res.Why = fmt.Sprintf("%s failed %d times, so it is not tried again. Remove it, or change the machines, to try again. Reason: %s",
			what, t.tries, reason)
		return res, errors.Join(errs...)
	}
	if t.tries > 0 && s.now().Before(t.next) {
		res.Why = fmt.Sprintf("%s failed (try %d of %d); next try at %s. Reason: %s",
			what, t.tries, LightMaxTries, t.next.UTC().Format("15:04 UTC"), reason)
		return res, errors.Join(errs...)
	}
	if len(failed) > 0 {
		f := failed[0]
		if err := s.discardFailed(ctx, f, actor, "light.failed_removed"); err != nil {
			res.Why = fmt.Sprintf("light runner %s failed and could not be cleaned up: %v", f.Name, err)
			return res, errors.Join(append(errs, err)...)
		}
	}
	name, why, err := s.addLight(ctx, repoID, repoName, os, actor)
	switch {
	case err != nil:
		t.repoID, t.os, t.hosts, t.reason = repoID, os, hosts, err.Error()
		t.tries++
		t.next = s.now().Add(lightBackoff(t.tries))
		s.setTry(key, &t)
		res.Why = err.Error()
		errs = append(errs, err)
	case why != "":
		res.Why = why
	default:
		res.Runner, res.Added = name, true
	}
	return res, errors.Join(errs...)
}

// discardFailed takes away what a failed runner left: a GitHub registration
// when there is one, its service with the account and folder, and its record.
// It stops at the first step that fails, so the record stays and a person can
// see what is left.
func (s *Service) discardFailed(ctx context.Context, r Record, actor, action string) error {
	t, err := s.Resolver.Resolve(ctx, r.Scope)
	if err != nil {
		return fmt.Errorf("resolve scope: %w", err)
	}
	list, err := s.GitHub.ListRunners(ctx, t.InstallationID, t.Scope)
	if err != nil {
		return fmt.Errorf("the runner list cannot be read, so nothing is removed: %w", err)
	}
	for _, g := range list {
		if g.Name != r.Name && (r.GitHubRunnerID == 0 || g.ID != r.GitHubRunnerID) {
			continue
		}
		if g.Busy {
			return fmt.Errorf("runner %s has a job on GitHub; it waits until the job ends", r.Name)
		}
		if err := s.GitHub.DeleteRunner(ctx, t.InstallationID, t.Scope, g.ID); err != nil {
			return fmt.Errorf("remove the registration of %s: %w", r.Name, err)
		}
	}
	service := r.ServiceName
	if service == "" && s.Services != nil {
		if found, err := s.Services(ctx, r.MachineID); err == nil {
			for _, f := range found {
				if f.Name == r.Name {
					service = f.ServiceName
				}
			}
		}
	}
	if service != "" {
		if err := s.Agent.CleanUp(ctx, r.MachineID, service); err != nil {
			return fmt.Errorf("clean up the %s %s: %w", cleanUpNoun(r), service, err)
		}
	}
	if err := s.Store.DeleteRunner(ctx, r.ID); err != nil {
		return err
	}
	s.audit(ctx, actor, action, r.MachineID, r.ID, r.Name)
	return nil
}

// cleanUpNoun says what a runner's clean-up target is: a container runner has
// a container, not a service.
func cleanUpNoun(r Record) string {
	if r.Backend == string(backend.Docker) {
		return "container"
	}
	return "service"
}

// addLight places and adds the light runner of one OS. A non-empty why means
// no machine could host it.
func (s *Service) addLight(ctx context.Context, repoID int64, repoName, os, actor string) (name, why string, err error) {
	hosts, err := s.Light.LightHosts(ctx, os)
	if err != nil {
		return "", "", err
	}
	if len(hosts) == 0 {
		return "", "no online " + OSName(os) + " machine has a light slot", nil
	}
	all, err := s.Store.ListRunners(ctx, Filter{})
	if err != nil {
		return "", "", err
	}
	count := map[string]int{}
	for _, r := range all {
		if IsLightRecord(r) {
			count[r.MachineID]++
		}
	}
	// The machine with the fewest light runners per light slot goes first.
	sort.SliceStable(hosts, func(i, j int) bool {
		return count[hosts[i].MachineID]*hosts[j].LightSlots < count[hosts[j].MachineID]*hosts[i].LightSlots
	})
	var lastWhy string
	for _, h := range hosts {
		if h.LightSlots < 1 {
			continue
		}
		m, err := s.Machines.GetMachine(ctx, h.MachineID)
		if err != nil {
			return "", "", err
		}
		be, err := chooseBackend(m, os, "persistent")
		if err != nil {
			lastWhy = err.Error()
			continue
		}
		verified := map[string]bool{}
		for _, v := range be.Verified {
			verified[v] = true
		}
		labels, err := ValidateLabels([]string{"self-hosted", os, m.Arch, LightLabel}, s.PoolName, verified)
		if err != nil {
			return "", "", refuse("%v", err)
		}
		held := all
		if s.Services != nil {
			// A service nobody has a record of still holds its name.
			if found, err := s.Services(ctx, h.MachineID); err == nil {
				for _, f := range found {
					held = append(held[:len(held):len(held)], Record{MachineID: h.MachineID, Name: f.Name, ServiceName: f.ServiceName})
				}
			}
		}
		spec := AddSpec{KeepDependencies: true, Name: lightName(held, h.MachineID, repoName, os, repoID), MachineID: m.ID, OS: os, Arch: m.Arch,
			Kind: "persistent", Backend: string(be.Name), Labels: labels,
			Scope: Scope{Kind: "repository", RepositoryID: repoID}, Symlink: m.Symlink, MaxParallel: m.MaxParallel()}
		if err := s.addRunner(ctx, spec, actor); err != nil {
			return "", "", err
		}
		return spec.Name, "", nil
	}
	if lastWhy == "" {
		lastWhy = "no online " + OSName(os) + " machine has a light slot"
	}
	return "", lastWhy, nil
}

// lightName is crsp-light-<repository>-<os>; a name that a record or a service
// on the machine already holds gets the repository id, then a number. A name
// is never reused while something still holds it.
func lightName(all []Record, machineID, repoName, os string, repoID int64) string {
	slug := strings.Trim(strings.ToLower(nonSlug.Replace(repoName)), "-")
	if slug == "" {
		slug = "repo"
	}
	taken := func(name string) bool {
		for _, r := range all {
			if r.MachineID == machineID && (r.Name == name || strings.HasSuffix(r.ServiceName, "."+name)) {
				return true
			}
		}
		return false
	}
	name := LightNamePrefix + slug + "-" + os
	if !taken(name) {
		return name
	}
	name = fmt.Sprintf("%s%s-%d-%s", LightNamePrefix, slug, repoID, os)
	for n := 2; taken(name); n++ {
		name = fmt.Sprintf("%s%s-%d-%s-%d", LightNamePrefix, slug, repoID, os, n)
	}
	return name
}

// RemoveLight removes the light runners of a repository, each after its job
// ends (the same drain as any removal). It returns the names it started to
// remove.
func (s *Service) RemoveLight(ctx context.Context, repoID int64, actor string) ([]string, error) {
	s.lightMu.Lock()
	defer s.lightMu.Unlock()
	have, err := s.lightRunners(ctx, repoID)
	if err != nil {
		return nil, err
	}
	var names []string
	var errs []error
	for _, r := range have {
		if r.State == Draining || r.State == Removing {
			continue
		}
		_, finish, err := s.BeginRemove(ctx, r.ID, true, actor)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		s.StartRemove(ctx, finish)
		names = append(names, r.Name)
	}
	return names, errors.Join(errs...)
}
