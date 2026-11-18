package repos

import (
	"context"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
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
	if pol.EphemeralOnly(r.Visibility) {
		return s.syncLightEphemeral(ctx, actor, r, pol)
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
	return s.syncLightVariable(ctx, actor, r, have > 0, LightValue)
}

// LightEphemeralValue is RUNS_ON_LIGHT of a repository whose jobs go to
// ephemeral runners only: the labels of an ephemeral Linux runner, as a JSON
// list like the RUNS_ON_* variables. The light runner is persistent and never
// carries the ephemeral label, so GitHub would never offer such a repository's
// job to it; the light job takes a fresh container instead (R5.60).
const LightEphemeralValue = `["self-hosted","linux","` + runners.EphemeralLabel + `"]`

// syncLightEphemeral keeps no light runner for a repository that is ephemeral
// only, removes the ones it had, and writes RUNS_ON_LIGHT with the ephemeral
// label while the setting is on and the pool serves Linux.
func (s *Service) syncLightEphemeral(ctx context.Context, actor auth.Principal, r Repository, pol Policy) error {
	if err := s.cfg.Light.RemoveLight(ctx, r, actor.Login); err != nil {
		return err
	}
	want := false
	if pol.LightRunner {
		oses, err := s.lightOSes(ctx, pol)
		if err != nil {
			return err
		}
		for _, o := range oses {
			want = want || o == "linux"
		}
	}
	return s.syncLightVariable(ctx, actor, r, want, LightEphemeralValue)
}

// syncLightVariable writes RUNS_ON_LIGHT when wanted and deletes it when not.
func (s *Service) syncLightVariable(ctx context.Context, actor auth.Principal, r Repository, want bool, value string) error {
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
	case exists && got == value:
		return s.recordVariable(ctx, r.ID, VarLight, got, VarOK, false)
	}
	if err := s.cfg.GitHub.SetVariable(ctx, r.InstallationID, r.Owner, r.Name, github.Variable{Name: VarLight, Value: value}); err != nil {
		return err
	}
	if err := s.recordVariable(ctx, r.ID, VarLight, value, VarOK, true); err != nil {
		return err
	}
	s.cfg.Audit.Audit(ctx, actor, "variable.written", "repository", r.FullName, VarLight+" = "+value)
	return nil
}
