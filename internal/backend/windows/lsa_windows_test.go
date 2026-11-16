//go:build windows

package windows

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// On a real Windows host the C# of the LSA and logon scripts compiles and
// reads the rights of a built-in account; nothing is changed.
func TestLSASourceCompilesAndReads(t *testing.T) {
	script := scriptHeader + lsaSource + logonSource + `
if (-not [CrspLsa]::Has('BUILTIN\Administrators', 'SeBackupPrivilege')) { throw 'Administrators should hold SeBackupPrivilege' }
if ([CrspLsa]::Has('BUILTIN\Administrators', 'SeDenyInteractiveLogonRight')) { throw 'Administrators must not be denied' }
if (-not [CrspLogon]::Check('crsp-no-such-account', 'x')) { throw 'a missing account must be refused' }
[Console]::Out.WriteLine('ok')
`
	// A file, not stdin: PowerShell reading a multi-line script from stdin
	// can end without running it and exit 0 with no output on a runner.
	file := filepath.Join(t.TempDir(), "lsa.ps1")
	if err := os.WriteFile(file, []byte("\xef\xbb\xbf"+wrapScript(script)), 0o600); err != nil {
		t.Fatal(err)
	}
	cmd := exec.CommandContext(t.Context(), "powershell.exe", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file)
	out, err := cmd.CombinedOutput()
	if err != nil || !strings.Contains(string(out), "ok") {
		t.Fatalf("err = %v, output = %s", err, out)
	}
}
