package repos

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Fleet removes the job runners of a repository that crsp stops serving
// (CRSP82). The runners service implements it through an adapter.
type Fleet interface {
	// RemoveRepositoryRunners removes every runner of the repository that has
	// no job; a runner with a job is left to end it. It returns the names removed.
	RemoveRepositoryRunners(ctx context.Context, repoID int64, actor string) ([]string, error)
}

// SetFleet sets who removes job runners. The wiring calls it once the runners
// service exists.
func (s *Service) SetFleet(f Fleet) { s.cfg.Fleet = f }

// StopServingPublic stops serving a repository that is public (github-integration
// R5.47, CRSP82): crsp serves private repositories only, because anyone can
// open a pull request against a public one. In this order: the pool is turned
// off (no runner is registered after this), the RUNS_ON variables are set to the
// hosted labels (so queued and new jobs run on GitHub), the runners are removed,
// and the audit log says why. Every step is tried even when an earlier one
// failed; the errors are joined. A repository whose pool is off is only marked
// public. It returns true when it stopped a served repository.
func (s *Service) StopServingPublic(ctx context.Context, r Repository, why string) (bool, error) {
	if r.Visibility != "public" {
		r.Visibility = "public"
		if err := s.cfg.Store.UpsertRepository(ctx, r); err != nil {
			return false, err
		}
	}
	if !r.PoolOn {
		return false, nil
	}
	if err := s.cfg.Store.SetRepositoryPool(ctx, r.ID, false, System.Login, s.cfg.Now()); err != nil {
		return false, err
	}
	s.dropFallback(r.ID)
	s.cfg.Audit.Audit(ctx, System, "pool.off", "repository", r.FullName,
		"the repository is public; crsp serves private repositories only ("+why+")")
	var errs []error
	if err := s.hostedVariables(ctx, r); err != nil {
		errs = append(errs, err)
	}
	if s.cfg.Light != nil {
		if err := s.cfg.Light.RemoveLight(ctx, r, System.Login); err != nil {
			errs = append(errs, err)
		}
	}
	if s.cfg.Fleet != nil {
		names, err := s.cfg.Fleet.RemoveRepositoryRunners(ctx, r.ID, System.Login)
		if err != nil {
			errs = append(errs, err)
		}
		if len(names) > 0 {
			s.cfg.Audit.Audit(ctx, System, "runners.removed", "repository", r.FullName, strings.Join(names, ", "))
		}
	}
	if err := errors.Join(errs...); err != nil {
		s.cfg.Audit.Audit(ctx, System, "public.stop_failed", "repository", r.FullName, publicError(err))
		return true, err
	}
	return true, nil
}

// hostedVariables sets every RUNS_ON variable that exists on the repository to
// the hosted label of its OS. An alias is set only where the controller wrote it.
func (s *Service) hostedVariables(ctx context.Context, r Repository) error {
	pol, err := s.policyOrDefault(ctx, r.ID)
	if err != nil {
		return err
	}
	have, err := s.cfg.GitHub.ListVariables(ctx, r.InstallationID, r.Owner, r.Name)
	if err != nil {
		return err
	}
	osOf := map[string]string{}
	for _, v := range variableOrder {
		osOf[v.Var] = v.OS
	}
	for _, a := range legacyAlias {
		osOf[a.Old] = osOf[a.Var]
	}
	var errs []error
	for _, v := range have {
		os, ok := osOf[v.Name]
		if !ok {
			continue
		}
		if isAlias(v.Name) {
			if yes, err := s.mayDelete(ctx, r, v.Name); err != nil || !yes {
				if err != nil {
					errs = append(errs, err)
				}
				continue
			}
		}
		b, _ := json.Marshal([]string{hostedLabel(pol, os)})
		val := string(b)
		if sameLabels(v.Value, val) {
			continue
		}
		if err := s.cfg.GitHub.SetVariable(ctx, r.InstallationID, r.Owner, r.Name, github.Variable{Name: v.Name, Value: val}); err != nil {
			errs = append(errs, err)
			continue
		}
		if err := s.recordVariable(ctx, r.ID, v.Name, val, VarOK, true); err != nil {
			errs = append(errs, err)
			continue
		}
		s.cfg.Audit.Audit(ctx, System, "variable.written", "repository", r.FullName, v.Name+" = "+val)
	}
	return errors.Join(errs...)
}

// Publicized is the repository webhook with action `publicized`: the repository
// just turned public. It stops serving it at once. A repository crsp does not
// know is ignored.
func (s *Service) Publicized(ctx context.Context, fullName string) error {
	rs, err := s.cfg.Store.ListRepositories(ctx, ListFilter{Query: fullName})
	if err != nil {
		return err
	}
	for _, r := range rs {
		if strings.EqualFold(r.FullName, fullName) {
			_, err := s.StopServingPublic(ctx, r, "GitHub reported it public (publicized webhook)")
			return err
		}
	}
	return nil
}

// stopPublicOnes stops every served repository that GitHub just reported
// public. Reconcile calls it after it read visibility (the periodic check,
// every 10 minutes); a repository it could not read is left as it is.
func (s *Service) stopPublicOnes(ctx context.Context, public map[int64]bool) error {
	pool := true
	on, err := s.cfg.Store.ListRepositories(ctx, ListFilter{Pool: &pool})
	if err != nil {
		return err
	}
	var errs []error
	for _, r := range on {
		if !public[r.ID] {
			continue
		}
		r.Visibility = "public"
		if _, err := s.StopServingPublic(ctx, r, "visibility check found it public"); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}
