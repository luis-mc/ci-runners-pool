package repos

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// variableOrder is the fixed order of operating systems and their variable.
var variableOrder = []struct{ OS, Var string }{
	{"Linux", "CRSP_RUNS_ON_LINUX"},
	{"Windows", "CRSP_RUNS_ON_WINDOWS"},
	{"macOS", "CRSP_RUNS_ON_MACOS"},
}

// VariableNames lists the three managed variable names.
func VariableNames() []string {
	out := make([]string, 0, len(variableOrder))
	for _, v := range variableOrder {
		out = append(out, v.Var)
	}
	return out
}

// labelList builds the JSON list for one OS: self-hosted, the OS, then the
// machines' labels, then the policy's labels, without repeats.
func labelList(os string, machine, policy []string) []string {
	out := []string{"self-hosted", os}
	seen := map[string]bool{"self-hosted": true, strings.ToLower(os): true}
	for _, set := range [][]string{machine, policy} {
		for _, l := range set {
			k := strings.ToLower(l)
			if seen[k] || osName(k) != "" {
				continue
			}
			seen[k] = true
			out = append(out, l)
		}
	}
	return out
}

func osName(lower string) string {
	switch lower {
	case "linux":
		return "Linux"
	case "windows":
		return "Windows"
	case "macos":
		return "macOS"
	}
	return ""
}

// Desired is the variables the controller keeps for a repository: one for each
// OS the policy enables and some machine can serve (R5.28). A policy whose
// labels name one or more operating systems enables only those; otherwise it
// enables every OS that a machine serves. Each value is a JSON list such as
// ["self-hosted","Linux","crsp-home"].
func (s *Service) Desired(ctx context.Context, pol Policy) (map[string]string, error) {
	capy, err := s.cfg.Capacity.OSLabels(ctx)
	if err != nil {
		return nil, err
	}
	enabled := map[string]bool{}
	for _, l := range pol.Labels {
		if n := osName(strings.ToLower(l)); n != "" {
			enabled[n] = true
		}
	}
	out := map[string]string{}
	for _, v := range variableOrder {
		labels, served := capy[v.OS]
		if !served || (len(enabled) > 0 && !enabled[v.OS]) {
			continue
		}
		b, _ := json.Marshal(labelList(v.OS, labels, pol.Labels))
		out[v.Var] = string(b)
	}
	return out, nil
}

// syncVariables writes the desired variables of an enabled repository and
// removes none (R5.28). Deleting is only done when the pool is turned off,
// after a yes (R5.29).
func (s *Service) syncVariables(ctx context.Context, actor auth.Principal, r Repository, pol Policy) error {
	want, err := s.Desired(ctx, pol)
	if err != nil {
		return err
	}
	have, err := s.cfg.GitHub.ListVariables(ctx, r.InstallationID, r.Owner, r.Name)
	if err != nil {
		return err
	}
	cur := map[string]string{}
	for _, v := range have {
		cur[v.Name] = v.Value
	}
	for _, name := range VariableNames() {
		val, ok := want[name]
		if !ok {
			continue
		}
		if cur[name] == val {
			if _, exists := cur[name]; exists {
				if err := s.recordVariable(ctx, r.ID, name, val, VarOK, false); err != nil {
					return err
				}
				continue
			}
		}
		if err := s.cfg.GitHub.SetVariable(ctx, r.InstallationID, r.Owner, r.Name, github.Variable{Name: name, Value: val}); err != nil {
			return err
		}
		if err := s.recordVariable(ctx, r.ID, name, val, VarOK, true); err != nil {
			return err
		}
		s.cfg.Audit.Audit(ctx, actor, "variable.written", "repository", r.FullName, name+" = "+val)
	}
	return nil
}

func (s *Service) recordVariable(ctx context.Context, repoID int64, name, value, status string, written bool) error {
	now := s.cfg.Now()
	if written {
		return s.cfg.Store.UpsertManagedVariable(ctx, ManagedVariable{RepositoryID: repoID, Name: name, Value: value, Status: status, WrittenAt: now, CheckedAt: now})
	}
	vars, err := s.cfg.Store.ListManagedVariables(ctx, repoID)
	if err != nil {
		return err
	}
	for _, v := range vars {
		if v.Name == name {
			return s.cfg.Store.SetManagedVariableStatus(ctx, repoID, name, status, now)
		}
	}
	return s.cfg.Store.UpsertManagedVariable(ctx, ManagedVariable{RepositoryID: repoID, Name: name, Value: value, Status: status, WrittenAt: now, CheckedAt: now})
}

// ReconcileVariables checks one enabled repository's variables against what
// they should be, as background work within the rate budget (R5.28, R6.6). A
// value changed outside the product is restored, written to the audit log, and
// shown as drift until the next check finds it correct. A missing variable is
// written back the same way.
func (s *Service) ReconcileVariables(ctx context.Context, repoID int64) error {
	r, err := s.cfg.Store.GetRepository(ctx, repoID)
	if err != nil {
		return err
	}
	if !r.PoolOn {
		return nil
	}
	pol, err := s.policyOrDefault(ctx, repoID)
	if err != nil {
		return err
	}
	want, err := s.Desired(ctx, pol)
	if err != nil {
		return err
	}
	bg := github.Background(ctx)
	have, err := s.cfg.GitHub.ListVariables(bg, r.InstallationID, r.Owner, r.Name)
	if err != nil {
		return err
	}
	cur := map[string]string{}
	for _, v := range have {
		cur[v.Name] = v.Value
	}
	now := s.cfg.Now()
	for _, name := range VariableNames() {
		val, ok := want[name]
		if !ok {
			continue
		}
		got, exists := cur[name]
		if exists && got == val {
			if err := s.recordVariable(ctx, repoID, name, val, VarOK, false); err != nil {
				return err
			}
			continue
		}
		status := VarWrong
		if !exists {
			status = VarMissing
		}
		// Record the drift first, so the row shows it even if the write fails.
		if err := s.cfg.Store.UpsertManagedVariable(ctx, ManagedVariable{RepositoryID: repoID, Name: name, Value: val, Status: status, WrittenAt: now, CheckedAt: now}); err != nil {
			return err
		}
		if err := s.cfg.GitHub.SetVariable(bg, r.InstallationID, r.Owner, r.Name, github.Variable{Name: name, Value: val}); err != nil {
			return err
		}
		s.cfg.Audit.Audit(ctx, System, "variable.restored", "repository", r.FullName,
			name+" was "+driftWas(exists, got)+"; restored to "+val)
		if err := s.cfg.Store.SetManagedVariableStatus(ctx, repoID, name, status, now); err != nil {
			return err
		}
	}
	return nil
}

func driftWas(exists bool, got string) string {
	if !exists {
		return "missing"
	}
	return got
}

// ReconcileAllVariables checks every enabled repository. On a rate limit it
// stops and returns the error, which carries the reset time (R6.6).
func (s *Service) ReconcileAllVariables(ctx context.Context) error {
	pool := true
	rs, err := s.cfg.Store.ListRepositories(ctx, ListFilter{Pool: &pool})
	if err != nil {
		return err
	}
	var errs []error
	for _, r := range rs {
		if err := s.ReconcileVariables(ctx, r.ID); err != nil {
			if errors.Is(err, github.ErrRateLimited) {
				return err
			}
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}
