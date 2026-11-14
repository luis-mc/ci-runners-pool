package repos

import (
	"context"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// lightOSes lists the OSes the repository's light runners are kept for: the
// ones that have a RUNS_ON_<OS> variable (R5.65).
func (s *Service) lightOSes(ctx context.Context, pol Policy) ([]string, error) {
	want, err := s.Desired(ctx, pol)
	if err != nil {
		return nil, err
	}
	var out []string
	for _, v := range variableOrder {
		if _, ok := want[v.Var]; ok {
			out = append(out, v.OS)
		}
	}
	return out, nil
}

// syncLight makes the light runners and RUNS_ON_LIGHT what the policy says
// (R5.65). With the setting on it keeps one light runner for each OS served and
// writes RUNS_ON_LIGHT once at least one is placed, so a workflow that reads
// the variable never waits for a runner that does not exist. With it off, the
// runners are removed after their jobs end and the variable is deleted. The
// pool must be on.
func (s *Service) syncLight(ctx context.Context, actor auth.Principal, r Repository, pol Policy) error {
	if !r.PoolOn || s.cfg.Light == nil {
		return nil
	}
	have := 0
	if pol.LightRunner {
		oses, err := s.lightOSes(ctx, pol)
		if err != nil {
			return err
		}
		if len(oses) > 0 {
			n, notes, err := s.cfg.Light.EnsureLight(ctx, r, oses, actor.Login)
			if err != nil {
				return err
			}
			have = n
			if len(notes) > 0 {
				s.cfg.Audit.Audit(ctx, actor, "light.unplaced", "repository", r.FullName, strings.Join(notes, "; "))
			}
		}
	} else if err := s.cfg.Light.RemoveLight(ctx, r, actor.Login); err != nil {
		return err
	}
	return s.syncLightVariable(ctx, actor, r, have > 0)
}

// syncLightVariable writes RUNS_ON_LIGHT when wanted and deletes it when not.
func (s *Service) syncLightVariable(ctx context.Context, actor auth.Principal, r Repository, want bool) error {
	have, err := s.cfg.GitHub.ListVariables(ctx, r.InstallationID, r.Owner, r.Name)
	if err != nil {
		return err
	}
	got, exists := "", false
	for _, v := range have {
		if v.Name == VarLight {
			got, exists = v.Value, true
		}
	}
	switch {
	case !want && exists:
		return s.deleteVariable(ctx, actor, r, VarLight)
	case !want:
		return nil
	case exists && got == LightValue:
		return s.recordVariable(ctx, r.ID, VarLight, got, VarOK, false)
	}
	if err := s.cfg.GitHub.SetVariable(ctx, r.InstallationID, r.Owner, r.Name, github.Variable{Name: VarLight, Value: LightValue}); err != nil {
		return err
	}
	if err := s.recordVariable(ctx, r.ID, VarLight, LightValue, VarOK, true); err != nil {
		return err
	}
	s.cfg.Audit.Audit(ctx, actor, "variable.written", "repository", r.FullName, VarLight+" = "+LightValue)
	return nil
}
