package runners

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
)

// LightLabel is the label of a light runner (scheduling R5.65). A job that
// asks for it runs on a light runner, which holds a light slot only.
const LightLabel = "crsp-light"

// LightNamePrefix starts the name of every light runner, so the job gate can
// tell one from the runner name alone.
const LightNamePrefix = "crsp-light-"

// IsLightName reports whether a runner name is a light runner's.
func IsLightName(name string) bool {
	return strings.HasPrefix(strings.ToLower(name), LightNamePrefix)
}

// IsLightRecord reports whether a record is a light runner.
func IsLightRecord(r Record) bool {
	for _, l := range r.Labels {
		if strings.EqualFold(l, LightLabel) {
			return true
		}
	}
	return false
}

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
		if r.Managed && IsLightRecord(r) && r.Scope.Kind == "repository" && r.Scope.RepositoryID == repoID {
			out = append(out, r)
		}
	}
	return out, nil
}

// LightRunners returns the light runners of a repository.
func (s *Service) LightRunners(ctx context.Context, repoID int64) ([]Record, error) {
	return s.lightRunners(ctx, repoID)
}

// EnsureLight keeps one light runner for the repository for each OS in oses,
// on a machine with light slots (scheduling R5.65). An OS that already has
// one is left alone. An OS without a machine that can host one is reported
// with its reason, not as an error.
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
		res := LightResult{OS: os}
		for _, r := range have {
			if r.OS == os && r.State != Failed {
				res.Runner = r.Name
			}
		}
		if res.Runner != "" {
			out = append(out, res)
			continue
		}
		name, why, err := s.addLight(ctx, repoID, repoName, os, actor)
		switch {
		case err != nil:
			res.Why = err.Error()
			errs = append(errs, fmt.Errorf("light runner for %s: %w", OSName(os), err))
		case why != "":
			res.Why = why
		default:
			res.Runner, res.Added = name, true
		}
		out = append(out, res)
	}
	return out, errors.Join(errs...)
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
		spec := AddSpec{Name: lightName(all, h.MachineID, repoName, os, repoID), MachineID: m.ID, OS: os, Arch: m.Arch,
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

// lightName is crsp-light-<repository>-<os>; a name taken on the machine by
// another repository gets the repository id too.
func lightName(all []Record, machineID, repoName, os string, repoID int64) string {
	slug := strings.Trim(strings.ToLower(nonSlug.Replace(repoName)), "-")
	if slug == "" {
		slug = "repo"
	}
	name := LightNamePrefix + slug + "-" + os
	for _, r := range all {
		if r.MachineID == machineID && r.Name == name {
			return fmt.Sprintf("%s%s-%d-%s", LightNamePrefix, slug, repoID, os)
		}
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
