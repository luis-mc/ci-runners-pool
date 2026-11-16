//go:build windows

package windows

import (
	"os/exec"
	"strings"
	"testing"
)

// On a real Windows host the C# of the LSA and logon scripts compiles and
// reads the rights of a built-in account; nothing is changed.
func TestLSASourceCompilesAndReads(t *testing.T) {
	script := scriptHeader + lsaSource + logonSource + `
if (-not [CrspLsa]::Has('NT AUTHORITY\SYSTEM', 'SeServiceLogonRight')) { throw 'SYSTEM should hold SeServiceLogonRight' }
if ([CrspLsa]::Has('NT AUTHORITY\SYSTEM', 'SeDenyInteractiveLogonRight')) { throw 'SYSTEM must not be denied' }
if (-not [CrspLogon]::Check('crsp-no-such-account', 'x')) { throw 'a missing account must be refused' }
Write-Output 'ok'
`
	cmd := exec.CommandContext(t.Context(), "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-")
	cmd.Stdin = strings.NewReader(wrapScript(script))
	out, err := cmd.CombinedOutput()
	if err != nil || !strings.Contains(string(out), "ok") {
		t.Fatalf("err = %v, output = %s", err, out)
	}
}
