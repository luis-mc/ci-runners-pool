package parity

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"
)

// The stable names of the parity report. The workflow uploads the file under
// the artifact name, so the newest one is always the one to read
// (artifact-prune.yml keeps one of each name).
const (
	ReportArtifactName = "parity-report"
	ReportFileName     = "parity-report.json"
	reportSchema       = 1
)

// Mode says how a report was made.
type Mode string

// The modes. Only ModeSoak counts toward the parity gate: a dry run proves the
// logic and says nothing about the pool.
const (
	ModeCheck  Mode = "check"
	ModeDryRun Mode = "soak-dry-run"
	ModeSoak   Mode = "soak"
)

// Report is the parity report.
type Report struct {
	Schema      int          `json:"schema"`
	Mode        Mode         `json:"mode"`
	GeneratedAt time.Time    `json:"generated_at"`
	Checks      []Check      `json:"checks"`
	Plan        *SoakPlan    `json:"plan,omitempty"`
	Soak        ClassResults `json:"soak,omitempty"`
	// Pass is true when every check passed and, when there is a soak, every
	// class passed. Set by Evaluate.
	Pass bool `json:"pass"`
	// CountsForGate is true only for a live soak that passed. A check-only run
	// and a dry run never count.
	CountsForGate bool     `json:"counts_for_gate"`
	Failures      []string `json:"failures,omitempty"`
}

// NewReport starts a report.
func NewReport(mode Mode, at time.Time) Report {
	return Report{Schema: reportSchema, Mode: mode, GeneratedAt: at.UTC()}
}

// Evaluate sets Pass, CountsForGate and Failures from the checks and the soak.
// A report with no check and no soak never passes: nothing was proven.
func (r *Report) Evaluate() {
	r.Failures = nil
	for _, c := range r.Checks {
		if c.Status != StatusPass {
			r.Failures = append(r.Failures, fmt.Sprintf("%s: %s %s", c.ID, c.Status, c.Detail))
		}
	}
	for _, c := range r.Soak {
		if !c.Pass {
			r.Failures = append(r.Failures, c.Describe())
		}
	}
	hasContent := len(r.Checks) > 0 || len(r.Soak) > 0
	r.Pass = hasContent && len(r.Failures) == 0
	r.CountsForGate = r.Pass && r.Mode == ModeSoak && len(r.Soak) > 0
}

// WriteJSON writes the report as indented JSON.
func (r Report) WriteJSON(w io.Writer) error {
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	if err := enc.Encode(r); err != nil {
		return fmt.Errorf("write parity report: %w", err)
	}
	return nil
}

// ReadReport reads a report written by WriteJSON.
func ReadReport(rd io.Reader) (Report, error) {
	var r Report
	dec := json.NewDecoder(rd)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&r); err != nil {
		return Report{}, fmt.Errorf("read parity report: %w", err)
	}
	if r.Schema != reportSchema {
		return Report{}, fmt.Errorf("read parity report: schema %d, want %d", r.Schema, reportSchema)
	}
	return r, nil
}

// Markdown is the summary for the workflow run page.
func (r Report) Markdown() string {
	var b strings.Builder
	verdict := "PASS"
	if !r.Pass {
		verdict = "FAIL"
	}
	fmt.Fprintf(&b, "## Parity report: %s\n\nMode `%s`, %s. Counts for the gate: %t.\n\n", verdict, r.Mode, r.GeneratedAt.Format(time.RFC3339), r.CountsForGate)
	if len(r.Checks) > 0 {
		b.WriteString("| Check | Result | Detail |\n|---|---|---|\n")
		for _, c := range r.Checks {
			fmt.Fprintf(&b, "| %s | %s | %s |\n", c.ID, c.Status, c.Detail)
		}
		b.WriteString("\n")
	}
	if len(r.Soak) > 0 {
		b.WriteString("| Class | Submitted | Lost | Duplicate | p95 wait (s) | Result |\n|---|---|---|---|---|---|\n")
		for _, c := range r.Soak {
			res := "pass"
			if !c.Pass {
				res = fmt.Sprintf("fail %v", c.Reasons)
			}
			fmt.Fprintf(&b, "| %s | %d | %d | %d | %.0f | %s |\n", c.Class, c.Submitted, c.Lost, c.DuplicateListeners, c.P95WaitSeconds, res)
		}
	}
	return b.String()
}
