package repos

import (
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// The controller wires the real GitHub client into the service: it must be a
// SecretWriter, or the setup answers "not available" in production (R5.84).
var _ SecretWriter = github.Client(nil)

func TestGrantPagesForAUserAndAnOrganization(t *testing.T) { // R5.84
	app, inst := grantPages(ParityInput{AppSlug: "crsp", AppOwnerType: "User", AppOwnerLogin: "alice"}, Installation{ID: 10, AccountType: "User", AccountLogin: "alice"})
	if app != "https://github.com/settings/apps/crsp/permissions" || inst != "https://github.com/settings/installations/10" {
		t.Fatalf("%s %s", app, inst)
	}
	app, inst = grantPages(ParityInput{AppSlug: "crsp", AppOwnerType: "Organization", AppOwnerLogin: "acme"}, Installation{ID: 7, AccountType: "Organization", AccountLogin: "acme"})
	if app != "https://github.com/organizations/acme/settings/apps/crsp/permissions" || inst != "https://github.com/organizations/acme/settings/installations/7" {
		t.Fatalf("%s %s", app, inst)
	}
}

func TestMissingParityJudgesWrite(t *testing.T) { // R5.84
	for _, c := range []struct {
		granted map[string]string
		want    string
	}{
		{map[string]string{"secrets": "write", "actions_variables": "write"}, ""},
		{map[string]string{"secrets": "admin", "actions_variables": "write"}, ""},
		{map[string]string{"secrets": "read", "actions_variables": "write"}, "secrets"},
		{map[string]string{"actions_variables": "write"}, "secrets"},
		{map[string]string{"secrets": "write", "actions_variables": "read"}, "actions_variables"},
		{nil, "secrets,actions_variables"},
	} {
		if got := strings.Join(missingParity(c.granted), ","); got != c.want {
			t.Errorf("%v: got %q, want %q", c.granted, got, c.want)
		}
	}
}
