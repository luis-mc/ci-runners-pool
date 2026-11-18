package runners

import (
	"context"
	"errors"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// DeleteOfflineRegistration deletes the registration of an offline runner
// whose agent cannot run the remove step, for example a machine that is gone
// (github-integration R5.33, the yes path).
//
// Without confirm it returns NeedsConfirmation naming the runner and what goes.
// With it, it asks GitHub right now: only a registration crsp made, listed as
// offline and not busy, is deleted with `DELETE .../actions/runners/{id}`. A
// runner that is online is refused (use remove, which drains), a busy one is
// left alone, and an unreadable list changes nothing. The clean-up on the
// machine is tried after the delete; a machine that is gone does not keep the
// record alive.
func (s *Service) DeleteOfflineRegistration(ctx context.Context, id string, confirm bool, actor string) (Record, error) {
	r, err := s.find(ctx, id)
	if err != nil {
		return Record{}, err
	}
	if !r.Managed {
		return r, refuse("runner %s was not made by CRSP; crsp does not delete its registration", r.Name)
	}
	t, err := s.Resolver.Resolve(ctx, r.Scope)
	if err != nil {
		return r, err
	}
	list, err := s.GitHub.ListRunners(ctx, t.InstallationID, t.Scope)
	if err != nil {
		return r, err // fail closed
	}
	var g *github.Runner
	for i := range list {
		if list[i].Name == r.Name {
			g = &list[i]
		}
	}
	switch {
	case g == nil:
		return r, refuse("GitHub does not list runner %s, so there is no registration to delete", r.Name)
	case r.GitHubRunnerID != 0 && r.GitHubRunnerID != g.ID:
		return r, refuse("the runner named %s at GitHub is not the registration crsp made", r.Name)
	case g.Busy:
		return r, refuse("GitHub says runner %s has a job; it is left alone", r.Name)
	case !strings.EqualFold(g.Status, "offline"):
		return r, refuse("runner %s is online; remove it instead, which waits for its job", r.Name)
	}
	if !confirm {
		return r, &NeedsConfirmation{Items: []ConfirmItem{
			{"registration", "The registration of offline runner " + r.Name + " on GitHub"},
			{"record", "The record of runner " + r.Name + " in crsp"},
			{"folder", "The runner folder " + r.Folder + ", if its machine answers"},
		}}
	}
	err = s.sweepOne(ctx, r, t, g.ID, actor, "runner.delete_offline", r.Name+", offline, deleted after a yes")
	if errors.Is(err, ErrRunnerBusy) {
		return r, refuse("GitHub says runner %s has a job; it is left alone", r.Name)
	}
	return r, err
}
