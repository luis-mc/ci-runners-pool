package repos

import (
	"errors"
	"sort"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
)

// PolicyUpdate is a partial change; nil fields keep their value (R5.25).
type PolicyUpdate struct {
	Priority        *int
	MaxParallelJobs *int
	AllowForkPRs    *bool
	// ConfirmForkRisk is the yes to the fork warning (R5.26).
	ConfirmForkRisk bool
	Labels          *[]string
	RunnerGroups    *[]string
	BudgetMemoryPct *int
	BudgetCPUPct    *int
	// LightRunner turns the repository's light runner on or off (R5.65).
	LightRunner *bool
	// LegacyVars turns the old variable names on or off (github-integration R5.39).
	LegacyVars *bool
}

// ErrForkNeedsConfirm: turning fork pull requests on asks first.
var ErrForkNeedsConfirm = errors.New("fork pull request code would run on your machines; confirm to turn it on")

// Apply returns p changed by u, validated (R5.25 to R5.27).
func (u PolicyUpdate) Apply(p Policy) (Policy, error) {
	if u.Priority != nil {
		if *u.Priority < -100 || *u.Priority > 100 {
			return p, auth.Invalid("priority must be between -100 and 100")
		}
		p.Priority = *u.Priority
	}
	if u.MaxParallelJobs != nil {
		if *u.MaxParallelJobs < 1 || *u.MaxParallelJobs > 256 {
			return p, auth.Invalid("maximum parallel jobs must be between 1 and 256")
		}
		p.MaxParallelJobs = *u.MaxParallelJobs
	}
	if u.AllowForkPRs != nil {
		if *u.AllowForkPRs && !p.AllowForkPRs && !u.ConfirmForkRisk {
			return p, ErrForkNeedsConfirm
		}
		p.AllowForkPRs = *u.AllowForkPRs
	}
	if u.Labels != nil {
		if err := CheckLabels(*u.Labels); err != nil {
			return p, err
		}
		p.Labels = normalizeList(*u.Labels)
	}
	if u.RunnerGroups != nil {
		for _, g := range *u.RunnerGroups {
			if strings.TrimSpace(g) == "" {
				return p, auth.Invalid("a runner group name must not be empty")
			}
		}
		p.RunnerGroups = normalizeList(*u.RunnerGroups)
	}
	if u.LightRunner != nil {
		p.LightRunner = *u.LightRunner
	}
	if u.LegacyVars != nil {
		p.LegacyVars = *u.LegacyVars
	}
	for _, b := range []struct {
		name string
		in   *int
		set  *int
	}{{"memory budget", u.BudgetMemoryPct, &p.BudgetMemoryPct}, {"CPU budget", u.BudgetCPUPct, &p.BudgetCPUPct}} {
		if b.in == nil {
			continue
		}
		if *b.in < 0 || *b.in > 100 {
			return p, auth.Invalid("%s must be between 1 and 100 (0 clears it)", b.name)
		}
		*b.set = *b.in
	}
	return p, nil
}

func normalizeList(in []string) []string {
	out := make([]string, 0, len(in))
	seen := map[string]bool{}
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" || seen[strings.ToLower(s)] {
			continue
		}
		seen[strings.ToLower(s)] = true
		out = append(out, s)
	}
	return out
}

func sortStrings(s []string) { sort.Strings(s) }
