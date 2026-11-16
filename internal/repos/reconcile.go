package repos

import (
	"context"
	"errors"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// ReconcileInstallations follows installation changes by reading the App's
// installations and their repositories with the App's own credentials (R5.22,
// R5.24). A repository that left an installation, or whose installation went
// away, is turned off and the audit log says why. Run every 10 minutes, and on
// an installation webhook.
func (s *Service) ReconcileInstallations(ctx context.Context) error {
	bg := github.Background(ctx)
	live, err := s.cfg.GitHub.ListAppInstallations(bg)
	if err != nil {
		return err
	}
	known, err := s.cfg.Store.ListInstallations(ctx)
	if err != nil {
		return err
	}
	liveIDs := map[int64]bool{}
	reach := map[int64]bool{}  // repository ids still reachable
	public := map[int64]bool{} // repository ids GitHub reported public just now
	for _, in := range live {
		liveIDs[in.ID] = true
		if err := s.cfg.Store.UpsertInstallation(ctx, toInstallation(in)); err != nil {
			return err
		}
		if in.Suspended {
			continue
		}
		rs, err := s.cfg.GitHub.ListAppRepositories(bg, in.ID)
		if err != nil {
			if errors.Is(err, github.ErrRateLimited) {
				return err
			}
			// Keep what we know for this installation; try again next round.
			for _, r := range s.reposOf(ctx, in.ID) {
				reach[r.ID] = true
			}
			continue
		}
		for _, r := range rs {
			reach[r.ID] = true
			public[r.ID] = r.Visibility == "public"
			if err := s.cfg.Store.UpsertRepository(ctx, toRepository(r, in.ID)); err != nil {
				return err
			}
		}
	}
	for _, k := range known {
		if !liveIDs[k.ID] {
			if err := s.cfg.Store.MarkInstallationRemoved(ctx, k.ID); err != nil {
				return err
			}
		}
	}
	pool := true
	on, err := s.cfg.Store.ListRepositories(ctx, ListFilter{Pool: &pool})
	if err != nil {
		return err
	}
	for _, r := range on {
		if reach[r.ID] {
			continue
		}
		if err := s.cfg.Store.SetRepositoryPool(ctx, r.ID, false, ChangedByInstallation, s.cfg.Now()); err != nil {
			return err
		}
		s.cfg.Audit.Audit(ctx, System, "pool.off", "repository", r.FullName, "the repository left the App's installation")
	}
	// A repository that came back keeps its pool off, but the console must
	// stop saying it left (R5.22).
	off := false
	gone, err := s.cfg.Store.ListRepositories(ctx, ListFilter{Pool: &off})
	if err != nil {
		return err
	}
	for _, r := range gone {
		if r.PoolChangedBy == ChangedByInstallation && reach[r.ID] {
			if err := s.cfg.Store.SetRepositoryPool(ctx, r.ID, false, System.Login, s.cfg.Now()); err != nil {
				return err
			}
		}
	}
	// The visibility just read is the periodic check of CRSP82.
	return s.stopPublicOnes(ctx, public)
}

func (s *Service) reposOf(ctx context.Context, installationID int64) []Repository {
	rs, _ := s.cfg.Store.ListRepositories(ctx, ListFilter{InstallationID: installationID})
	return rs
}
