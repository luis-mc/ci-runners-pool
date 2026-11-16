package tray

import (
	"fmt"
	"strings"
)

// Menu item labels. Words come from docs/design-system/v1/content.md (R6.7).
const (
	ProductName       = "CI Runners Shared Pool"
	LabelOpen         = "Open " + ProductName
	LabelCheck        = "Look for updates"
	LabelRestart      = "Restart the service"
	LabelOpenLogs     = "Open log folder"
	LabelOpenGitHub   = "Open on GitHub"
	LabelStartAtLogin = "Start at login"
	LabelQuit         = "Quit tray"
	LabelMode         = "Mode"
	LabelAutomatic    = "Automatic"
	LabelAlways       = "Always"
	LabelPaused       = "Paused"
	LabelPauseHour    = "Pause for 1 hour"
	LabelPauseUntil   = "Pause until I resume"
	LabelResume       = "Resume"
	// RepoURL is the repository page that Open on GitHub opens.
	RepoURL = "https://github.com/luis-mc/ci-runners-shared-pool"
)

// Item IDs, in menu order. The update item sits after Look for updates and is
// shown only when a newer release waits for a yes (auto-update off).
const (
	IDHeader    = "header"
	IDService   = "service"
	IDSep1      = "sep1"
	IDMode      = "mode"
	IDModeAuto  = "mode_automatic"
	IDModeAlw   = "mode_always"
	IDModePause = "mode_paused"
	IDPauseHour = "pause_hour"
	IDPauseTill = "pause_until_resumed"
	IDResume    = "resume"
	IDOpen      = "open"
	IDCheck     = "check"
	IDUpdate    = "update"
	IDRestart   = "restart"
	IDLogs      = "logs"
	IDGitHub    = "github"
	IDLogin     = "login"
	IDSep2      = "sep2"
	IDQuit      = "quit"
	updateLabel = "Update to "
)

// MenuItem is one entry of the tray menu.
type MenuItem struct {
	ID        string
	Label     string
	Action    bool // pressable
	Switch    bool // has a tick
	Checked   bool
	Separator bool
	Hidden    bool // present in the model, not shown
	// Parent is the ID of the submenu this item sits in; empty for the top level.
	Parent string
	// Radio marks an item of a group where exactly one is ticked (Checked).
	Radio bool
}

// UpdateInfo is what the service says about updates (operations R5.11 to R5.18).
type UpdateInfo struct {
	Latest    string // newest stable release found, "" before the first look
	Available bool
	State     string // idle, checking, waiting_for_jobs, downloading, installing, restarting, failed
	AutoOff   bool   // auto-update is turned off (it is on by default)
	// ReleaseURL is the release page of Latest; Jobs is how many jobs run now (a drain waits for them).
	ReleaseURL string
	Jobs       int
}

// Updating says whether an update is in progress (drain, download, install).
func (u UpdateInfo) Updating() bool {
	switch u.State {
	case "waiting_for_jobs", "downloading", "installing", "restarting":
		return true
	}
	return false
}

// Header is the first menu line: product, version and update state.
// With no answer from the service the state is not known and is not claimed.
func Header(version string, st Status) string {
	base := ProductName + " " + version
	switch st.State {
	case StateStarting, StateStopped:
		return base
	}
	switch {
	case st.Update.State == "failed":
		base += " - update failed"
	case st.Update.Updating():
		base += " - updating…"
	case st.Update.Available && st.Update.Latest != "":
		base += " - update " + st.Update.Latest + " available"
	default:
		base += " - up to date"
	}
	if st.Update.AutoOff {
		base += " · auto-update off"
	}
	if w := st.Policy.Word(); w != "" {
		base += " · " + w
	}
	return base
}

// ServiceLine is the second menu line: "Service: Running · 2 jobs running · 1 waiting".
// The state is always a word (UX-58); the tooltip keeps the glyph.
func (s Status) ServiceLine() string {
	word := map[State]string{
		StateHealthy: "Running", StateWaiting: "Waiting", StateFailed: "Failed",
		StateStopped: "Stopped", StateStarting: "Starting",
	}[s.State]
	if word == "" {
		word = "Starting"
	}
	var b strings.Builder
	b.WriteString("Service: " + word)
	switch s.State {
	case StateStopped:
		if !s.StoppedAt.IsZero() {
			b.WriteString(" at " + s.StoppedAt.Format("15:04"))
		}
		fmt.Fprintf(&b, " · exit code %d", s.ExitCode)
	case StateFailed:
		if s.Fault != "" {
			b.WriteString(" · " + s.Fault)
		}
	case StateStarting:
	default:
		if s.State == StateHealthy && s.Runners == 0 && s.Running == 0 && s.Waiting == 0 {
			b.WriteString(" · no runners yet")
			break
		}
		fmt.Fprintf(&b, " · %s running · %d waiting", plural(s.Running, "job"), s.Waiting)
	}
	return b.String()
}

func plural(n int, noun string) string {
	if n == 1 {
		return fmt.Sprintf("1 %s", noun)
	}
	return fmt.Sprintf("%d %ss", n, noun)
}

// BuildMenu returns the tray menu in order (R5.1). The same list is built for
// Windows, macOS and Linux.
func BuildMenu(version string, st Status, startAtLogin bool) []MenuItem {
	showUpdate := st.Update.Available && st.Update.AutoOff && !st.Update.Updating() && st.Update.Latest != ""
	return append(append([]MenuItem{
		{ID: IDHeader, Label: Header(version, st)},
		{ID: IDService, Label: st.ServiceLine()},
		{ID: IDSep1, Separator: true},
	}, policyItems(st)...), buildRest(st, startAtLogin, showUpdate)...)
}

// policyItems are the Mode submenu, the pause items and Resume (CRSP75, R5.31).
// With no policy from the service they are hidden: an older service cannot
// change the mode. The three modes are radio items; the one in force is ticked.
// Pause items hide while the user holds a pause, and Resume shows then.
func policyItems(st Status) []MenuItem {
	p := st.Policy
	hide := !p.Known
	mode := p.Mode
	if mode == "" {
		mode = ModeAutomatic
	}
	paused := p.UserPaused()
	return []MenuItem{
		{ID: IDMode, Label: LabelMode, Action: true, Hidden: hide},
		{ID: IDModeAuto, Label: LabelAutomatic, Action: true, Radio: true, Switch: true, Checked: mode == ModeAutomatic, Parent: IDMode, Hidden: hide},
		{ID: IDModeAlw, Label: LabelAlways, Action: true, Radio: true, Switch: true, Checked: mode == ModeAlways, Parent: IDMode, Hidden: hide},
		{ID: IDModePause, Label: LabelPaused, Action: true, Radio: true, Switch: true, Checked: mode == ModePaused, Parent: IDMode, Hidden: hide},
		{ID: IDPauseHour, Label: LabelPauseHour, Action: true, Hidden: hide || paused},
		{ID: IDPauseTill, Label: LabelPauseUntil, Action: true, Hidden: hide || paused},
		{ID: IDResume, Label: LabelResume, Action: true, Hidden: hide || !paused},
	}
}

func buildRest(st Status, startAtLogin, showUpdate bool) []MenuItem {
	return []MenuItem{
		{ID: IDOpen, Label: LabelOpen, Action: true},
		{ID: IDCheck, Label: LabelCheck, Action: true},
		{ID: IDUpdate, Label: updateLabel + st.Update.Latest, Action: true, Hidden: !showUpdate},
		{ID: IDRestart, Label: LabelRestart, Action: true},
		{ID: IDLogs, Label: LabelOpenLogs, Action: true},
		{ID: IDGitHub, Label: LabelOpenGitHub, Action: true},
		{ID: IDLogin, Label: LabelStartAtLogin, Action: true, Switch: true, Checked: startAtLogin},
		{ID: IDSep2, Separator: true},
		{ID: IDQuit, Label: LabelQuit, Action: true},
	}
}

// Visible drops the hidden items.
func Visible(items []MenuItem) []MenuItem {
	var out []MenuItem
	for _, it := range items {
		if !it.Hidden {
			out = append(out, it)
		}
	}
	return out
}
