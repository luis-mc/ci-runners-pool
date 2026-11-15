package parity

import (
	"fmt"
	"strings"
)

// Status is the result of one check.
type Status string

// The statuses of a check. Only Pass counts as green; a skipped check is
// shown and keeps the report from passing.
const (
	StatusPass Status = "pass"
	StatusFail Status = "fail"
	StatusSkip Status = "skip"
)

// Check is one line of the report.
type Check struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Status Status `json:"status"`
	Detail string `json:"detail,omitempty"`
}

// RunnerInfo is a runner of the pool, reduced to what the checks read.
type RunnerInfo struct {
	Name   string `json:"name"`
	Class  Class  `json:"class"`
	Online bool   `json:"online"`
}

// Finding is a doctor finding, reduced to what the checks read.
type Finding struct {
	Severity string `json:"severity"`
	Title    string `json:"title"`
}

// PoolSnapshot is what `crsp parity check` reads from the controller.
type PoolSnapshot struct {
	Runners  []RunnerInfo `json:"runners"`
	Findings []Finding    `json:"findings"`
}

// ClassOf maps a runner or a job to its soak class from its facts. A VM
// isolation or a `kvm` label is a VM; the Windows OS is Windows; anything else
// that runs on Linux is a container.
func ClassOf(os, isolation string, labels []string) (Class, bool) {
	for _, l := range labels {
		if strings.EqualFold(l, "kvm") {
			return ClassVM, true
		}
	}
	switch {
	case strings.EqualFold(isolation, "vm"), strings.EqualFold(isolation, "microvm"):
		return ClassVM, true
	case strings.EqualFold(os, "windows"):
		return ClassWindows, true
	case strings.EqualFold(os, "linux"):
		return ClassLinuxContainer, true
	}
	return "", false
}

// CheckPool runs the pool checks on a snapshot:
//
//   - pool.runners.<class>: each class has at least one online runner (P6, P7);
//   - pool.listeners: no runner name is listed twice (P6);
//   - pool.doctor: the doctor has no warn and no fail (P6).
func CheckPool(s PoolSnapshot) []Check {
	var out []Check
	for _, class := range Classes() {
		online, total := 0, 0
		for _, r := range s.Runners {
			if r.Class != class {
				continue
			}
			total++
			if r.Online {
				online++
			}
		}
		c := Check{ID: "pool.runners." + string(class), Title: fmt.Sprintf("A %s runner is online", class)}
		if online > 0 {
			c.Status = StatusPass
			c.Detail = fmt.Sprintf("%d of %d online", online, total)
		} else {
			c.Status = StatusFail
			c.Detail = fmt.Sprintf("0 of %d online", total)
		}
		out = append(out, c)
	}

	seen := map[string]int{}
	for _, r := range s.Runners {
		seen[r.Name]++
	}
	dup := Check{ID: "pool.listeners", Title: "No runner name is listed twice", Status: StatusPass}
	var names []string
	for _, r := range s.Runners {
		if seen[r.Name] > 1 {
			names = append(names, r.Name)
			seen[r.Name] = 0 // name it once
		}
	}
	if len(names) > 0 {
		dup.Status = StatusFail
		dup.Detail = strings.Join(names, ", ")
	}
	out = append(out, dup)

	doc := Check{ID: "pool.doctor", Title: "The doctor has no warn and no fail", Status: StatusPass}
	var bad []string
	for _, f := range s.Findings {
		if f.Severity == "warn" || f.Severity == "fail" {
			bad = append(bad, f.Severity+": "+f.Title)
		}
	}
	if len(bad) > 0 {
		doc.Status = StatusFail
		doc.Detail = strings.Join(bad, "; ")
	}
	return append(out, doc)
}
