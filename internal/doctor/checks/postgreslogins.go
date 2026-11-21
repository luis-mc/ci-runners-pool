package checks

import (
	"context"

	"github.com/luis-mc/ci-runners-shared-pool/internal/doctor"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
)

// runnerPostgresLogins: a Postgres login that no runner uses (a leftover of a
// runner removed while the server was down, or of an older build). It only
// reads and offers the removal as a next step; it never removes (R5.7,
// R5.50). New check, OPS53.
func runnerPostgresLogins(ctx context.Context, env doctor.Env) []doctor.Finding {
	if env.Postgres == nil {
		return []doctor.Finding{skip("runner.postgres_logins", controllerSubject, "Postgres is not read", "No Postgres server was reported, so its logins were not checked.")}
	}
	logins, err := env.Postgres.PostgresLogins(ctx)
	if err != nil {
		return []doctor.Finding{skipFor("runner.postgres_logins", controllerSubject, "The Postgres logins", err)}
	}
	rs, err := env.Fleet.Runners(ctx)
	if err != nil {
		return []doctor.Finding{skipFor("runner.postgres_logins", controllerSubject, "The runner list", err)}
	}
	used := map[string]bool{}
	for _, r := range rs {
		used[runners.LoginName(r.ID)] = true
	}
	var out []doctor.Finding
	for _, l := range logins {
		if used[l.Name] {
			continue
		}
		why := "It belongs to no shared owner role, so an older build made it."
		if l.OwnerRole != "" {
			why = "It is a member of " + l.OwnerRole + "."
		}
		out = append(out, doctor.Finding{Check: "runner.postgres_logins",
			Subject: doctor.Subject{Kind: "runner", ID: l.Name, Name: l.Name}, Severity: doctor.Warn,
			Title:  "The Postgres login " + l.Name + " is used by no runner",
			Detail: "No runner has this login, so its database and password are left over. " + why + " Nothing was removed.",
			Fix:    doctor.Fix{Text: "Remove the login " + l.Name + " from the Doctor screen when you are sure no job needs it. The doctor never removes it on its own.", Link: "/doctor"}})
	}
	if len(out) == 0 {
		return []doctor.Finding{{Check: "runner.postgres_logins", Subject: controllerSubject, Severity: doctor.OK,
			Title: "Every Postgres login belongs to a runner"}}
	}
	return out
}
