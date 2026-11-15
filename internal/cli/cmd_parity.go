package cli

import (
	"flag"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/client"
	"github.com/luis-mc/ci-runners-shared-pool/internal/cli/output"
	"github.com/luis-mc/ci-runners-shared-pool/internal/parity"
)

func cmdParity() *command {
	return &command{
		name: "parity", summary: "the parity gate against the old pool: checks, soak, report",
		subs: []*command{
			{name: "check", summary: "check the pool and write the parity report", args: "[--out FILE]",
				flags: func(c *call, fs *flag.FlagSet) {
					fs.String("out", "", "write the report as JSON to this file")
				},
				run: func(c *call, _ []string) error { return c.parityCheck() }},
			{name: "soak", summary: "judge a soak: from observations, or a dry run with fakes", args: "(--dry-run [--fault F] | --observations FILE) [--out FILE]",
				flags: func(c *call, fs *flag.FlagSet) {
					def := parity.DefaultPlan()
					fs.Bool("dry-run", false, "judge a fake soak; never counts for the gate")
					fs.String("fault", "", "with --dry-run: lost, duplicate or slow, to see the report fail")
					fs.String("observations", "", "JSON file with the jobs and listeners the soak saw")
					fs.Int("jobs", def.JobsPerClass, "jobs of each class")
					fs.Duration("duration", def.Duration, "window the jobs are spread over")
					fs.Duration("p95", def.P95WaitBound, "most the p95 queue wait may be")
					fs.String("out", "", "write the report as JSON to this file")
				},
				run: func(c *call, _ []string) error { return c.paritySoak() }},
			{name: "report", summary: "read a parity report and set the exit code by it", args: "FILE [--markdown]",
				flags: func(c *call, fs *flag.FlagSet) {
					fs.Bool("markdown", false, "print the summary as Markdown")
				},
				run: func(c *call, args []string) error { return c.parityReport(args) }},
		},
	}
}

func (c *call) parityCheck() error {
	s, err := c.open()
	if err != nil {
		return err
	}
	runners, err := c.runners(s, client.ListRunnersParams{})
	if err != nil {
		return err
	}
	run, err := c.doctorRun(s, client.DoctorScope{})
	if err != nil {
		return err
	}
	snap := parity.PoolSnapshot{}
	for _, r := range runners {
		iso := string(r.Isolation)
		class, ok := parity.ClassOf(string(r.Os), iso, r.Labels)
		if !ok {
			continue
		}
		online := r.State == client.RunnerStateIdle || r.State == client.RunnerStateBusy
		snap.Runners = append(snap.Runners, parity.RunnerInfo{Name: r.Name, Class: class, Online: online})
	}
	for _, f := range run.Findings {
		snap.Findings = append(snap.Findings, parity.Finding{Severity: string(f.Severity), Title: f.Title})
	}
	rep := parity.NewReport(parity.ModeCheck, c.env.Now())
	rep.Checks = parity.CheckPool(snap)
	return c.parityFinish(rep)
}

func (c *call) paritySoak() error {
	f := func(n string) string { return c.fs.Lookup(n).Value.String() }
	dry := f("dry-run") == "true"
	obsFile := f("observations")
	if dry == (obsFile != "") {
		return fail(ExitUsage, "Usage: crsp parity soak (--dry-run | --observations FILE) [--out FILE]. Give exactly one.")
	}
	jobs := mustInt(f("jobs"))
	dur, _ := time.ParseDuration(f("duration"))
	bound, _ := time.ParseDuration(f("p95"))
	plan := parity.SoakPlan{JobsPerClass: jobs, Duration: dur, P95WaitBound: bound}
	if err := plan.Validate(); err != nil {
		return fail(ExitUsage, "The soak plan is not valid: %v", err)
	}
	rep := parity.NewReport(parity.ModeSoak, c.env.Now())
	rep.Plan = &plan
	var src parity.Source
	if dry {
		rep.Mode = parity.ModeDryRun
		fault := parity.Fault(f("fault"))
		switch fault {
		case parity.FaultNone, parity.FaultLostJob, parity.FaultDuplicate, parity.FaultSlow:
		default:
			return fail(ExitUsage, "--fault must be lost, duplicate or slow.")
		}
		src = parity.FakeSource{Epoch: c.env.Now(), Fault: fault}
	} else {
		src = fileSource{path: obsFile}
	}
	res, err := parity.Run(plan, src)
	if err != nil {
		return fail(ExitFailed, "%v", err)
	}
	rep.Soak = res
	return c.parityFinish(rep)
}

// fileSource reads an observation from a JSON file.
type fileSource struct{ path string }

func (s fileSource) Observe(parity.SoakPlan) (parity.Observation, error) {
	b, err := os.ReadFile(s.path)
	if err != nil {
		return parity.Observation{}, fmt.Errorf("read %s: %w", s.path, err)
	}
	var obs parity.Observation
	if err := decodeStrict(b, &obs); err != nil {
		return parity.Observation{}, fmt.Errorf("parse %s: %w", s.path, err)
	}
	return obs, nil
}

func (c *call) parityReport(args []string) error {
	if len(args) != 1 {
		return fail(ExitUsage, "Usage: crsp parity report FILE [--markdown]")
	}
	fh, err := os.Open(args[0])
	if err != nil {
		return fail(ExitNotFound, "Could not open the report: %v", err)
	}
	defer func() { _ = fh.Close() }()
	rep, err := parity.ReadReport(fh)
	if err != nil {
		return fail(ExitFailed, "%v", err)
	}
	// The verdict is judged again from the parts, so an edited file cannot
	// say pass.
	rep.Evaluate()
	return c.parityPrint(rep, c.fs.Lookup("markdown").Value.String() == "true")
}

// parityFinish judges a new report, writes it and sets the exit code.
func (c *call) parityFinish(rep parity.Report) error {
	rep.Evaluate()
	if out := c.fs.Lookup("out").Value.String(); out != "" {
		if err := writeReportFile(out, rep); err != nil {
			return fail(ExitFailed, "Could not write the report: %v", err)
		}
	}
	return c.parityPrint(rep, false)
}

func (c *call) parityPrint(rep parity.Report, markdown bool) error {
	switch {
	case c.g.json:
		if err := output.JSON(c.env.Stdout, rep); err != nil {
			return err
		}
	case markdown:
		_, _ = io.WriteString(c.env.Stdout, rep.Markdown())
	default:
		var rows [][]string
		for _, k := range rep.Checks {
			rows = append(rows, []string{string(k.Status), k.ID, k.Detail})
		}
		for _, r := range rep.Soak {
			res := "pass"
			if !r.Pass {
				res = "fail"
			}
			rows = append(rows, []string{res, "soak." + string(r.Class), r.Describe()})
		}
		if len(rows) > 0 {
			output.Table(c.env.Stdout, output.MaxWidth, []string{"RESULT", "CHECK", "DETAIL"}, rows)
		}
		if rep.Mode == parity.ModeDryRun {
			_, _ = fmt.Fprintln(c.env.Stderr, "Dry run with fakes. This never counts for the parity gate.")
		}
	}
	if !rep.Pass {
		return &exitError{Code: ExitFindings, Message: "The parity report did not pass."}
	}
	return nil
}

func writeReportFile(path string, rep parity.Report) (err error) {
	fh, err := os.Create(path) //nolint:gosec // the path is the caller's own --out
	if err != nil {
		return fmt.Errorf("create %s: %w", path, err)
	}
	defer func() {
		if cerr := fh.Close(); err == nil && cerr != nil {
			err = fmt.Errorf("close %s: %w", path, cerr)
		}
	}()
	return rep.WriteJSON(fh)
}
