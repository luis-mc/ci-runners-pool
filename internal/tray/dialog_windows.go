//go:build windows

package tray

import (
	"context"
	"errors"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"syscall"
	"time"
)

// dialogTimeout ends a dialog nobody answered, so a hidden one cannot live forever.
const dialogTimeout = 30 * time.Minute

// createNoWindow is CREATE_NO_WINDOW: no console window for powershell. HideWindow
// would put SW_HIDE in STARTUPINFO, which Windows applies to the form itself.
const createNoWindow = 0x08000000

// dialogProcAttr is the process attribute of the dialog child.
func dialogProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{CreationFlags: createNoWindow}
}

// updateScript is a small WinForms dialog: What changed link, Later (left) and
// Install now (right, default). It prints "install" for Install now, nothing else.
// The texts come in through the environment, so no quoting reaches the script.
const updateScript = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
$f = New-Object System.Windows.Forms.Form
$f.Text = $env:CRSP_DLG_TITLE; $f.StartPosition = 'CenterScreen'; $f.TopMost = $true
$f.FormBorderStyle = 'FixedDialog'; $f.MaximizeBox = $false; $f.MinimizeBox = $false; $f.ShowInTaskbar = $true
$f.Add_Shown({ $f.Activate() })
$f.ClientSize = New-Object System.Drawing.Size(420, 170)
$l = New-Object System.Windows.Forms.Label
$l.Text = $env:CRSP_DLG_BODY; $l.Location = New-Object System.Drawing.Point(16, 14); $l.Size = New-Object System.Drawing.Size(388, 80)
$k = New-Object System.Windows.Forms.LinkLabel
$k.Text = $env:CRSP_DLG_CHANGED; $k.AutoSize = $true; $k.Location = New-Object System.Drawing.Point(16, 98)
$k.Add_LinkClicked({ if ($env:CRSP_DLG_URL) { Start-Process $env:CRSP_DLG_URL } })
$later = New-Object System.Windows.Forms.Button
$later.Text = $env:CRSP_DLG_LATER; $later.Size = New-Object System.Drawing.Size(100, 28); $later.Location = New-Object System.Drawing.Point(188, 130)
$later.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
$now = New-Object System.Windows.Forms.Button
$now.Text = $env:CRSP_DLG_NOW; $now.Size = New-Object System.Drawing.Size(100, 28); $now.Location = New-Object System.Drawing.Point(304, 130)
$now.DialogResult = [System.Windows.Forms.DialogResult]::OK
$f.Controls.AddRange(@($l, $k, $later, $now)); $f.AcceptButton = $now; $f.CancelButton = $later
if ($f.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write('install') }`

// AskUpdate shows the update dialog on the user's desktop and waits for the answer.
func AskUpdate(p UpdatePrompt, _ Launcher) (bool, error) {
	ps := os.Getenv("SystemRoot") + `\System32\WindowsPowerShell\v1.0\powershell.exe`
	ctx, cancel := context.WithTimeout(context.Background(), dialogTimeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, ps, "-NoProfile", "-NonInteractive", "-STA", "-ExecutionPolicy", "Bypass", "-Command", updateScript) //nolint:gosec // fixed script, texts in the environment
	cmd.SysProcAttr = dialogProcAttr()
	cmd.Env = append(os.Environ(),
		"CRSP_DLG_TITLE="+PromptTitle, "CRSP_DLG_BODY="+p.Body(), "CRSP_DLG_CHANGED="+PromptChanged,
		"CRSP_DLG_URL="+p.ReleaseURL, "CRSP_DLG_LATER="+PromptLater, "CRSP_DLG_NOW="+PromptInstallNow)
	out, err := cmd.Output()
	if err != nil {
		var ee *exec.ExitError
		if errors.As(err, &ee) {
			return false, errors.New("the dialog ended with an error: " + strconv.Itoa(ee.ExitCode()))
		}
		return false, ErrNoDialog
	}
	return strings.TrimSpace(string(out)) == "install", nil
}
