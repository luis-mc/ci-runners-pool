package runners

import (
	"context"
	"fmt"
	"sort"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// Facts is what GitHub and the machine's agent say about one runner right now.
// A fact that could not be read is not Known; it never counts as "fine".
type Facts struct {
	GitHubKnown  bool
	GitHub       *github.Runner // nil: GitHub does not list the runner
	ServiceKnown bool
	Service      *backend.Found // nil: the agent does not see the service
}

// Truth is the state a runner shows and the reason for it (web-console UX-19).
// A runner is idle only when GitHub reports it online and not busy and its
// service runs; anything else shows what is real.
func Truth(r Record, f Facts) (State, string) {
	switch r.State {
	case Creating, Draining, Updating, Removing:
		if r.Reason != "" {
			return r.State, r.Reason
		}
		return r.State, map[State]string{Creating: "it is being set up", Draining: "it ends its job, then it is removed",
			Updating: "its files are being replaced", Removing: "it is being removed"}[r.State]
	case Failed:
		if r.Reason == "" {
			return Failed, "the runner did not start"
		}
		return Failed, r.Reason
	}
	if f.ServiceKnown {
		switch {
		case f.Service == nil:
			return Stopped, "its service is not on the machine"
		case !f.Service.Running:
			return Stopped, "its service is stopped"
		}
	}
	switch {
	case !f.GitHubKnown:
		return Unknown, "GitHub could not be read, so the state is not known"
	case f.GitHub == nil:
		return NotRegistered, "GitHub does not list a runner with this name"
	case f.GitHub.Status != "online":
		return Offline, "GitHub reports it offline"
	case f.GitHub.Busy:
		return Busy, ""
	}
	return Idle, ""
}

// View is a runner record with its true state and its machine's name.
type View struct {
	Record
	// State is what to show; Record.State is what was stored.
	State       State
	Reason      string
	MachineName string
}

// ListView lists runners with the state each one really has, from GitHub's
// runner list and the agent's service list (UX-19).
func (s *Service) ListView(ctx context.Context, f Filter) ([]View, error) {
	recs, err := s.Store.ListRunners(ctx, f)
	if err != nil {
		return nil, err
	}
	return s.views(ctx, recs), nil
}

// GetView is ListView for one runner.
func (s *Service) GetView(ctx context.Context, id string) (View, error) {
	r, err := s.Store.GetRunner(ctx, id)
	if err != nil {
		return View{}, err
	}
	return s.views(ctx, []Record{r})[0], nil
}

type ghList struct {
	ok   bool
	list []github.Runner
}

func (s *Service) views(ctx context.Context, recs []Record) []View {
	gh := map[string]ghList{}
	svc := map[string]map[string]backend.Found{}
	names := map[string]string{}
	out := make([]View, 0, len(recs))
	for _, r := range recs {
		if _, ok := names[r.MachineID]; !ok {
			names[r.MachineID] = r.MachineID
			if s.Machines != nil {
				if m, err := s.Machines.GetMachine(ctx, r.MachineID); err == nil && m.Name != "" {
					names[r.MachineID] = m.Name
				}
			}
		}
		var f Facts
		if r.State == Idle || r.State == Busy || r.State == Offline {
			key := fmt.Sprintf("%s|%d|%s|%s", r.Scope.Kind, r.Scope.RepositoryID, r.Scope.Organization, r.Scope.Group)
			l, seen := gh[key]
			if !seen {
				l = s.githubList(ctx, r.Scope)
				gh[key] = l
			}
			f.GitHubKnown = l.ok
			for i := range l.list {
				if l.list[i].Name == r.Name || (r.GitHubRunnerID != 0 && l.list[i].ID == r.GitHubRunnerID) {
					g := l.list[i]
					f.GitHub = &g
					break
				}
			}
			if r.Kind == "persistent" && s.Services != nil {
				m, seen := svc[r.MachineID]
				if !seen {
					if found, err := s.Services(ctx, r.MachineID); err == nil {
						m = map[string]backend.Found{}
						for _, x := range found {
							m[x.ServiceName] = x
						}
					}
					svc[r.MachineID] = m
				}
				if m != nil {
					f.ServiceKnown = true
					if x, ok := m[r.ServiceName]; ok && r.ServiceName != "" {
						f.Service = &x
					}
				}
			}
		}
		state, why := Truth(r, f)
		out = append(out, View{Record: r, State: state, Reason: why, MachineName: names[r.MachineID]})
	}
	sort.SliceStable(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (s *Service) githubList(ctx context.Context, sc Scope) ghList {
	if s.Resolver == nil || s.GitHub == nil {
		return ghList{}
	}
	t, err := s.Resolver.Resolve(ctx, sc)
	if err != nil {
		return ghList{}
	}
	list, err := s.GitHub.ListRunners(ctx, t.InstallationID, t.Scope)
	if err != nil {
		return ghList{}
	}
	return ghList{ok: true, list: list}
}
