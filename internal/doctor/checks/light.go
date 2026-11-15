package checks

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor/runson"
	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// lightLabel is the label of a light runner (scheduling R5.65).
const lightLabel = "crsp-light"

func lightSubject(r doctor.Repository, os string) doctor.Subject {
	return doctor.Subject{Kind: "light_runner", ID: fmt.Sprintf("%d:%s", r.ID, os), Name: r.FullName + " light runner (" + osTitle(os) + ")"}
}

// repoLight: each pool repository whose policy keeps a light runner has one
// online for every OS it serves, or the finding says why not (scheduling
// R5.65). New check.
func repoLight(ctx context.Context, env doctor.Env) []doctor.Finding {
	repos, out := poolRepos(ctx, env, "repo.light")
	for _, r := range repos {
		if !r.LightRunner {
			continue
		}
		var oses []string
		for name := range r.Expected {
			if os := runson.OSOfVariable(name); os != "" {
				oses = append(oses, os)
			}
		}
		sort.Strings(oses)
		if len(oses) == 0 {
			continue
		}
		list, err := ghRunners(ctx, env, r.InstallationID, github.RunnerScope{Owner: r.Owner, Repo: r.Name})
		if err != nil {
			out = append(out, skipFor("repo.light", repoSubject(r), "The runners of "+r.FullName, err))
			continue
		}
		machines, err := env.Fleet.Machines(ctx)
		if err != nil {
			out = append(out, skipFor("repo.light", repoSubject(r), "The machines", err))
			continue
		}
		managed, err := env.Fleet.Runners(ctx)
		if err != nil {
			out = append(out, skipFor("repo.light", repoSubject(r), "The runners", err))
			continue
		}
		for _, os := range oses {
			out = append(out, lightFinding(r, os, list, machines, managed))
		}
	}
	return out
}

func lightFinding(r doctor.Repository, os string, list []github.Runner, machines []doctor.Machine, managed []doctor.Runner) doctor.Finding {
	f := doctor.Finding{Check: "repo.light", Subject: lightSubject(r, os)}
	for _, gr := range list {
		if gr.Status == "online" && hasLabel(gr.Labels, lightLabel) && hasLabel(gr.Labels, os) {
			f.Severity, f.Title = doctor.OK, "The light runner is online for "+osTitle(os)+" on "+r.FullName
			return f
		}
	}
	f.Severity = doctor.Warn
	f.Title = "No light runner is online for " + osTitle(os) + " on " + r.FullName
	f.Fix = doctor.Fix{Text: "Set light slots above 0 on a machine of this OS, or turn the light runner off for the repository.", Link: "/repositories"}
	for _, m := range managed {
		if hasLabel(m.Labels, lightLabel) && m.Scope.Owner == r.Owner && m.Scope.Repo == r.Name && strings.EqualFold(m.OS, os) {
			f.Detail = "Light runner " + m.Name + " on " + m.MachineName + " is not online on GitHub, so jobs that read RUNS_ON_LIGHT wait."
			f.Fix = doctor.Fix{Text: "Start its service on " + m.MachineName + ", or remove the runner and the next check places a new one.", Link: "/runners"}
			return f
		}
	}
	for _, m := range machines {
		if strings.EqualFold(m.OS, os) && m.Online && m.LightSlots > 0 && (m.State == "" || m.State == "active") {
			f.Detail = "A machine has a light slot, but no light runner is placed on it yet. The check that runs every 10 minutes adds one."
			return f
		}
	}
	f.Detail = "No online " + osTitle(os) + " machine has a light slot, so there is nowhere to place it. RUNS_ON_LIGHT is not written until one is placed."
	return f
}

func hasLabel(labels []string, want string) bool {
	for _, l := range labels {
		if strings.EqualFold(l, want) {
			return true
		}
	}
	return false
}
