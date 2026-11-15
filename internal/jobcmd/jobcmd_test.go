package jobcmd

import (
	"strings"
	"testing"
)

func TestStubsSayNotYetImplementedAndFail(t *testing.T) {
	for _, name := range []string{"vm", "db-env"} {
		var b strings.Builder
		if !Handles(name) {
			t.Fatalf("%s not handled", name)
		}
		if code := Run(name, nil, &b); code != ExitNotImplemented {
			t.Errorf("%s: exit %d", name, code)
		}
		if !strings.Contains(b.String(), NotYetImplemented) {
			t.Errorf("%s: output %q", name, b.String())
		}
	}
	if Handles("doctor") {
		t.Error("doctor must stay with the CLI")
	}
}
