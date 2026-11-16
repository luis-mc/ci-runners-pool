package repos

import (
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// The controller wires the real GitHub client into the service: it must be a
// SecretWriter, or the setup answers "not available" in production (R5.84).
var _ SecretWriter = github.Client(nil)

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
		{nil, "actions_variables,secrets"},
	} {
		if got := strings.Join(missingParity(c.granted), ","); got != c.want {
			t.Errorf("%v: got %q, want %q", c.granted, got, c.want)
		}
	}
}
