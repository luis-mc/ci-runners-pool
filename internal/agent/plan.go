package agent

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strings"
	"unicode/utf16"
)

// Account names (machines R5.44): the agent never runs as an administrator.
const (
	WindowsAccount = `NT SERVICE\crsp-agent`
	LinuxAccount   = "crsp-agent"
	MacAccount     = "_crsp_agent"
	// ServiceName is the service, unit or launchd label.
	ServiceName = "crsp-agent"
	// LaunchdLabel is the macOS LaunchDaemon label.
	LaunchdLabel = "dev.crsp.agent"
)

// ErrNotConfirmed is returned when the user did not say yes to the install plan
// (R5.45): nothing ran.
var ErrNotConfirmed = errors.New("the install plan was not confirmed; nothing was changed")

// InstallOptions are what the install step needs.
type InstallOptions struct {
	// Binary is the path of the crsp binary to run as the service.
	Binary     string
	Controller string // host:8461
	// Fingerprint and JoinCode come from the install command (R5.3).
	Fingerprint string
	JoinCode    string
	// BackendGroups are groups the agent account joins so a detected backend works
	// (docker, kvm); only groups that exist are added.
	BackendGroups []string
	DataDir       string
	// WindowsSymlinkRight asks the plan to grant "create symbolic links" to the
	// service account (owner decision for M1, runners R5.14).
	WindowsSymlinkRight bool
}

// File is a file the plan writes.
type File struct {
	Path string
	Body string
	Mode os.FileMode
}

// Step is one action of the plan.
type Step struct {
	// Admin is true when the step needs administrator rights.
	Admin bool
	// What is the words shown before the yes (R5.45): one admin action.
	What     string
	Commands [][]string
	Files    []File
}

// Plan is the install step: every admin action it will take, listed first.
type Plan struct {
	OS      string
	Account string
	Steps   []Step
}

// Executor runs a plan's actions. Production runs real commands; tests record.
type Executor interface {
	Run(ctx context.Context, argv []string) error
	WriteFile(ctx context.Context, f File) error
}

// psEncoded makes the argv of a PowerShell call whose script travels as an
// encoded command, so no quoting of a command line is involved (R5.47, learning 5:
// PowerShell 5.1 mangles quoted arguments to native programs).
func psEncoded(script string) []string {
	u := utf16.Encode([]rune(script))
	b := make([]byte, 0, len(u)*2)
	for _, c := range u {
		b = append(b, byte(c), byte(c>>8))
	}
	return []string{"powershell.exe", "-NoProfile", "-NonInteractive", "-EncodedCommand", base64.StdEncoding.EncodeToString(b)}
}

// BuildInstallPlan lists what the install step does on goos. It is a pure
// function: nothing runs until Run is called with a yes (R5.45).
func BuildInstallPlan(goos string, o InstallOptions) (Plan, error) {
	if o.Binary == "" || o.Controller == "" || o.Fingerprint == "" {
		return Plan{}, errors.New("the install plan needs the binary path, the controller address and the fingerprint")
	}
	if o.DataDir == "" {
		o.DataDir = defaultDataDir(goos)
	}
	switch goos {
	case "linux":
		return linuxPlan(o), nil
	case "darwin":
		return macPlan(o), nil
	case "windows":
		return windowsPlan(o), nil
	}
	return Plan{}, fmt.Errorf("no install plan for %s", goos)
}

func defaultDataDir(goos string) string {
	switch goos {
	case "windows":
		return `C:\ProgramData\crsp-agent`
	case "darwin":
		return "/Library/Application Support/crsp-agent"
	}
	return "/var/lib/crsp-agent"
}

func joinArgs(o InstallOptions) []string {
	args := []string{"agent", "join", "--controller", o.Controller, "--fingerprint", o.Fingerprint, "--data-dir", o.DataDir}
	if o.JoinCode != "" {
		args = append(args, "--join-code", o.JoinCode)
	}
	return args
}

func linuxPlan(o InstallOptions) Plan {
	p := Plan{OS: "linux", Account: LinuxAccount}
	p.Steps = append(p.Steps, Step{Admin: true, What: "create the system user " + LinuxAccount + " (no login, no admin rights)",
		Commands: [][]string{{"useradd", "--system", "--home-dir", o.DataDir, "--create-home", "--shell", "/usr/sbin/nologin", LinuxAccount}}})
	for _, g := range o.BackendGroups {
		p.Steps = append(p.Steps, Step{Admin: true, What: "add " + LinuxAccount + " to the group " + g + " (a backend needs it)",
			Commands: [][]string{{"usermod", "-aG", g, LinuxAccount}}})
	}
	unit := fmt.Sprintf(`[Unit]
Description=CRSP agent
After=network-online.target
Wants=network-online.target

[Service]
User=%s
ExecStart=%s agent run --controller %s --data-dir %s
Restart=always
RestartSec=5
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
`, LinuxAccount, o.Binary, o.Controller, o.DataDir)
	p.Steps = append(p.Steps,
		Step{Admin: true, What: "write the systemd unit /etc/systemd/system/crsp-agent.service (starts at boot, restarts after a crash)",
			Files: []File{{Path: "/etc/systemd/system/crsp-agent.service", Body: unit, Mode: 0o644}}},
		Step{Admin: true, What: "join the controller as " + LinuxAccount + " with the one-time code",
			Commands: [][]string{append([]string{"runuser", "-u", LinuxAccount, "--", o.Binary}, joinArgs(o)...)}},
		Step{Admin: true, What: "start the service now and at every boot",
			Commands: [][]string{{"systemctl", "daemon-reload"}, {"systemctl", "enable", "--now", ServiceName}}},
	)
	return p
}

func macPlan(o InstallOptions) Plan {
	p := Plan{OS: "macos", Account: MacAccount}
	plist := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>%s</string>
<key>UserName</key><string>%s</string>
<key>ProgramArguments</key><array><string>%s</string><string>agent</string><string>run</string><string>--controller</string><string>%s</string><string>--data-dir</string><string>%s</string></array>
<key>RunAtLoad</key><true/>
<key>KeepAlive</key><true/>
</dict></plist>
`, LaunchdLabel, MacAccount, o.Binary, o.Controller, o.DataDir)
	plistPath := "/Library/LaunchDaemons/" + LaunchdLabel + ".plist"
	p.Steps = append(p.Steps,
		Step{Admin: true, What: "create the hidden daemon user " + MacAccount + " (no login, no admin rights)", Commands: [][]string{
			{"dscl", ".", "-create", "/Users/" + MacAccount},
			{"dscl", ".", "-create", "/Users/" + MacAccount, "UserShell", "/usr/bin/false"},
			{"dscl", ".", "-create", "/Users/" + MacAccount, "NFSHomeDirectory", o.DataDir},
			{"dscl", ".", "-create", "/Users/" + MacAccount, "IsHidden", "1"},
		}},
		Step{Admin: true, What: "write the LaunchDaemon " + plistPath + " (starts at boot, restarts after a crash)",
			Files: []File{{Path: plistPath, Body: plist, Mode: 0o644}}},
		Step{Admin: true, What: "join the controller as " + MacAccount + " with the one-time code",
			Commands: [][]string{append([]string{"sudo", "-u", MacAccount, o.Binary}, joinArgs(o)...)}},
		Step{Admin: true, What: "load the LaunchDaemon now and at every boot",
			Commands: [][]string{{"launchctl", "bootstrap", "system", plistPath}}},
	)
	return p
}

func windowsPlan(o InstallOptions) Plan {
	p := Plan{OS: "windows", Account: WindowsAccount}
	bin := fmt.Sprintf("%s agent run --controller %s --data-dir %s", o.Binary, o.Controller, o.DataDir)
	// The service and its restart policy are registered with PowerShell cmdlets,
	// the script travels encoded, never as a cmd-quoted command line (R5.47).
	create := fmt.Sprintf("$ErrorActionPreference='Stop'\nNew-Service -Name '%s' -DisplayName 'CRSP agent' -BinaryPathName '%s' -StartupType Automatic | Out-Null\n",
		ServiceName, strings.ReplaceAll(bin, "'", "''"))
	steps := []Step{
		{Admin: true, What: "create the data folder " + o.DataDir + " and give it to " + WindowsAccount + " only (the virtual service account is made with the service)",
			Commands: [][]string{psEncoded(fmt.Sprintf("$ErrorActionPreference='Stop'\nNew-Item -ItemType Directory -Force -Path '%s' | Out-Null\n", o.DataDir))}},
		{Admin: true, What: "register the Windows service " + ServiceName + " that starts at boot, running as " + WindowsAccount, Commands: [][]string{psEncoded(create)}},
		{Admin: true, What: "make the service restart after a crash",
			Commands: [][]string{{"sc.exe", "failure", ServiceName, "reset=", "86400", "actions=", "restart/5000/restart/5000/restart/30000"}}},
	}
	if o.WindowsSymlinkRight {
		steps = append(steps, Step{Admin: true, What: "grant \"create symbolic links\" to " + WindowsAccount + " (you chose this; some build tools need it)",
			Commands: [][]string{psEncoded(symlinkScript)}})
	}
	steps = append(steps,
		Step{Admin: true, What: "join the controller with the one-time code",
			Commands: [][]string{append([]string{o.Binary}, joinArgs(o)...)}},
		Step{Admin: true, What: "start the service", Commands: [][]string{psEncoded("$ErrorActionPreference='Stop'\nStart-Service -Name '" + ServiceName + "'\n")}},
	)
	p.Steps = steps
	return p
}

// Describe is the text shown before the yes: each admin action, one per line.
func (p Plan) Describe() string {
	var b strings.Builder
	fmt.Fprintf(&b, "The install step needs administrator rights for %d actions. The agent itself then runs as %s, never as an administrator:\n", p.adminCount(), p.Account)
	for i, s := range p.Steps {
		if s.Admin {
			fmt.Fprintf(&b, "  %d. %s\n", i+1, s.What)
		}
	}
	return b.String()
}

func (p Plan) adminCount() int {
	n := 0
	for _, s := range p.Steps {
		if s.Admin {
			n++
		}
	}
	return n
}

// Run lists the plan, asks for a yes through confirm and only then runs each
// step. Without a yes nothing runs (R5.45). A step that fails stops the plan and
// says which one.
func (p Plan) Run(ctx context.Context, confirm func(description string) bool, ex Executor) error {
	if confirm == nil || !confirm(p.Describe()) {
		return ErrNotConfirmed
	}
	for i, s := range p.Steps {
		for _, f := range s.Files {
			if err := ex.WriteFile(ctx, f); err != nil {
				return fmt.Errorf("step %d (%s): %w", i+1, s.What, err)
			}
		}
		for _, c := range s.Commands {
			if err := ex.Run(ctx, c); err != nil {
				return fmt.Errorf("step %d (%s): %w", i+1, s.What, err)
			}
		}
	}
	return nil
}

// symlinkScript adds SeCreateSymbolicLinkPrivilege for the service account to the
// local security policy: export, edit the one line, import (user rights only).
const symlinkScript = `$ErrorActionPreference='Stop'
$sid = (New-Object System.Security.Principal.NTAccount('NT SERVICE\crsp-agent')).Translate([System.Security.Principal.SecurityIdentifier]).Value
$cfg = Join-Path $env:TEMP 'crsp-secpol.inf'
$db = Join-Path $env:TEMP 'crsp-secpol.sdb'
secedit.exe /export /cfg $cfg /areas USER_RIGHTS | Out-Null
$lines = Get-Content -Path $cfg
$found = $false
$out = foreach ($l in $lines) {
  if ($l -match '^SeCreateSymbolicLinkPrivilege\s*=') { $found = $true; if ($l -notmatch [regex]::Escape($sid)) { $l + ',*' + $sid } else { $l } } else { $l }
}
if (-not $found) { $out = $out + ('SeCreateSymbolicLinkPrivilege = *' + $sid) }
Set-Content -Path $cfg -Value $out
secedit.exe /configure /db $db /cfg $cfg /areas USER_RIGHTS | Out-Null
Remove-Item -Path $cfg,$db -Force -ErrorAction SilentlyContinue
`
