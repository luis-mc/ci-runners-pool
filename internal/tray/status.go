package tray

import (
	"fmt"
	"strings"
	"time"
)

// State is what the tray shows about the local service.
type State string

// States, spec section 4. The icon is the same disc with CRSP in it; the disc colour and the words name the state (R5.4, decision tray D8).
const (
	StateStarting State = "starting"
	StateHealthy  State = "ok"
	StateWaiting  State = "waiting"
	StateFailed   State = "failed"
	StateStopped  State = "stopped"
)

// MaxTooltip is the Windows tooltip limit in characters (R6.5).
const MaxTooltip = 127

// Glyph returns the UX-58 glyph of a state.
func Glyph(s State) string {
	switch s {
	case StateHealthy:
		return "✓"
	case StateWaiting:
		return "◷"
	case StateFailed, StateStopped:
		return "✕"
	default:
		return "▶"
	}
}

// Status is one reading of the local service.
type Status struct {
	State     State
	Running   int
	Waiting   int
	Runners   int       // runners configured; 0 with StateHealthy reads "no runners yet"
	Fault     string    // StateFailed: why
	StoppedAt time.Time // StateStopped
	ExitCode  int       // StateStopped
	Version   string    // the version the service runs, "" when it does not say
	Update    UpdateInfo
}

// Text is the status line and the tooltip body (R5.2), without the product name.
func (s Status) Text() string {
	g := Glyph(s.State)
	switch s.State {
	case StateStopped:
		when := ""
		if !s.StoppedAt.IsZero() {
			when = " at " + s.StoppedAt.Format("15:04")
		}
		return fmt.Sprintf("%s stopped%s · exit code %d", g, when, s.ExitCode)
	case StateFailed:
		if s.Fault != "" {
			return fmt.Sprintf("%s failed · %s", g, s.Fault)
		}
		return g + " failed"
	case StateStarting:
		return g + " starting"
	case StateHealthy:
		if s.Runners == 0 && s.Running == 0 && s.Waiting == 0 {
			return g + " ok · no runners yet"
		}
	}
	return fmt.Sprintf("%s %s · %d running · %d waiting", g, s.State, s.Running, s.Waiting)
}

// Tooltip is "crsp: " + Text, cut at MaxTooltip characters with an ellipsis.
func (s Status) Tooltip() string {
	return cut("crsp: "+s.Text(), MaxTooltip)
}

func cut(t string, max int) string {
	r := []rune(t)
	if len(r) <= max {
		return t
	}
	return strings.TrimRight(string(r[:max-1]), " ") + "…"
}
