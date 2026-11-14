package hooks

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// WorkFolder is the job's checkout folder when it is safe to empty: inside a
// _work folder, and not _work itself (R5.29; runner_job_done.py work_folder).
func WorkFolder(workspace string) string {
	if workspace == "" {
		return ""
	}
	abs, err := filepath.Abs(workspace)
	if err != nil {
		return ""
	}
	parts := strings.Split(strings.ToLower(strings.ReplaceAll(abs, `\`, "/")), "/")
	hasWork := false
	for _, p := range parts {
		if p == "_work" {
			hasWork = true
		}
	}
	if !hasWork || parts[len(parts)-1] == "_work" {
		return ""
	}
	return abs
}

// EmptyFolder deletes everything inside path and returns how many entries it
// could not remove. The folder itself stays (R5.29).
func EmptyFolder(path string) int {
	entries, err := os.ReadDir(path)
	if err != nil {
		return 0
	}
	failed := 0
	for _, e := range entries {
		if os.RemoveAll(filepath.Join(path, e.Name())) != nil {
			failed++
		}
	}
	return failed
}

// DoneConfig is everything one run of the job-completed hook needs.
type DoneConfig struct {
	Client    Client
	MachineID string
	Job       scheduler.JobRef
	Workspace string
	KeepWork  bool
	Log       func(string)
	// Report and Healthy are as in GateConfig (R5.60). Both may be nil.
	Report  func(string)
	Healthy func()
}

// RunJobDone frees every slot of every kind the job holds with the outcome ran
// and empties its work folder. It always returns 0, even on an error, and logs
// the error: a hook that fails here would fail a job that already finished
// (R5.28 to R5.30).
func RunJobDone(ctx context.Context, cfg DoneConfig) (code int) {
	log := func(format string, a ...any) {
		if cfg.Log != nil {
			cfg.Log("runner job done: " + fmt.Sprintf(format, a...))
		}
	}
	defer func() {
		if r := recover(); r != nil {
			log("skipped (%v)", r)
			code = 0
		}
	}()
	if cfg.Client == nil {
		log("agent not reachable: slots are freed later by the stale rules")
		if cfg.Report != nil {
			cfg.Report(unreachableText("job-completed", ErrUnreachable))
		}
	} else {
		machine := cfg.MachineID
		if machine == "" {
			if h, err := cfg.Client.Hello(ctx); err == nil {
				machine = h.MachineID
			}
		}
		freed, err := cfg.Client.Release(ctx, machine, cfg.Job, nil)
		switch {
		case err != nil:
			log("skipped (%v): slots are freed later by the stale rules", err)
			if cfg.Report != nil {
				cfg.Report(unreachableText("job-completed", err))
			}
		case len(freed) == 0:
			if cfg.Healthy != nil {
				cfg.Healthy()
			}
			log("this job held no slot")
		default:
			if cfg.Healthy != nil {
				cfg.Healthy()
			}
			for _, f := range freed {
				if f.Number > 0 {
					log("freed slot %s of %s run %d job %s", slots.SlotLabel(slots.Kind(f.Kind), f.Number), cfg.Job.Repository, cfg.Job.RunID, cfg.Job.Job)
				}
			}
		}
	}
	if !cfg.KeepWork {
		if work := WorkFolder(cfg.Workspace); work != "" {
			bad := EmptyFolder(work)
			if bad > 0 {
				log("emptied %s (%d entries stay)", work, bad)
			} else {
				log("emptied %s", work)
			}
		}
	}
	return 0
}
