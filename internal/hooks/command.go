package hooks

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/load"
	"github.com/luis-mc/ci-runners-shared-pool/internal/scheduler/slots"
)

// SocketEnv names the agent's local socket.
const SocketEnv = "CRSP_AGENT_SOCKET"

// DefaultSocket is where the agent listens when SocketEnv is not set.
func DefaultSocket() string {
	if runtime.GOOS == "windows" {
		pd := os.Getenv("PROGRAMDATA")
		if pd == "" {
			pd = `C:\ProgramData`
		}
		return filepath.Join(pd, "crsp", "agent.sock")
	}
	return "/var/run/crsp/agent.sock"
}

// Env is the process environment a hook runs in; tests pass their own.
type Env struct {
	Getenv func(string) string
	Stdout io.Writer
	Stderr io.Writer
	// Client overrides the socket client (tests, an in-process agent).
	Client Client
	// Sleep, Now and Measure override the real ones (tests).
	Sleep   func(ctx context.Context, d time.Duration)
	Now     func() time.Time
	Measure func() load.Reading
}

// Run is `crsp hook <job-started|job-completed> [flags]`. It returns the exit
// code. job-completed always returns 0 (R5.30).
func Run(ctx context.Context, args []string, e Env) int {
	if e.Getenv == nil {
		e.Getenv = os.Getenv
	}
	if len(args) == 0 {
		_, _ = fmt.Fprintln(e.Stderr, "usage: crsp hook job-started|job-completed [flags]")
		return 2
	}
	if e.Getenv(ProbeEnv) == "1" && (args[0] == "job-started" || args[0] == "job-completed") {
		_, _ = fmt.Fprintln(e.Stdout, ProbeOK)
		return 0
	}
	switch args[0] {
	case "job-started":
		return runStarted(ctx, args[1:], e)
	case "job-completed":
		return runCompleted(ctx, args[1:], e)
	}
	_, _ = fmt.Fprintf(e.Stderr, "unknown hook %q\n", args[0])
	return 2
}

// jobFromEnv reads the job's identity from the runner's environment (R5.28).
func jobFromEnv(getenv func(string) string) scheduler.JobRef {
	run, _ := strconv.ParseInt(getenv("GITHUB_RUN_ID"), 10, 64)
	att, _ := strconv.Atoi(getenv("GITHUB_RUN_ATTEMPT"))
	if att < 1 {
		att = 1
	}
	return scheduler.JobRef{Repository: getenv("GITHUB_REPOSITORY"), RunID: run, RunAttempt: att, Job: getenv("GITHUB_JOB"),
		Shard: getenv("CRSP_SHARD"), RunnerName: getenv("RUNNER_NAME")}
}

func (e Env) client() Client {
	if e.Client != nil {
		return e.Client
	}
	path := e.Getenv(SocketEnv)
	if path == "" {
		path = DefaultSocket()
	}
	return &SocketClient{Path: path}
}

// logger writes each line to stdout (the job's Set up job step) and the agent log file.
func (e Env) logger(path string) func(string) {
	return func(line string) {
		line = time.Now().Format("2006-01-02 15:04:05") + " " + line
		_, _ = fmt.Fprintln(e.Stdout, line)
		if path == "" {
			return
		}
		if os.MkdirAll(filepath.Dir(path), 0o755) != nil {
			return
		}
		f, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			return
		}
		_, _ = fmt.Fprintln(f, line)
		_ = f.Close()
	}
}

func defaultLogPath(getenv func(string) string) string {
	if p := getenv("CRSP_GATE_LOG"); p != "" {
		return p
	}
	return ""
}

func runStarted(ctx context.Context, args []string, e Env) int {
	fs := flag.NewFlagSet("job-started", flag.ContinueOnError)
	fs.SetOutput(e.Stderr)
	maxWait := fs.Int("max-wait", -1, "maximum wait in minutes")
	poll := fs.Int("poll", -1, "poll interval in seconds")
	onTimeout := fs.String("on-timeout", "", "fail or run")
	logPath := fs.String("log", defaultLogPath(e.Getenv), "agent log file")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	log := e.logger(*logPath)
	var gateID [8]byte
	_, _ = rand.Read(gateID[:])
	machine := slots.Defaults()
	cfg := GateConfig{
		Client:     e.client(),
		Machine:    machine,
		Gate:       slots.ResolveGate(*maxWait, *poll, *onTimeout, e.Getenv, machine),
		Job:        jobFromEnv(e.Getenv),
		EventClass: slots.EventClass(e.Getenv),
		Holder:     scheduler.Holder{HolderPID: HolderPID(e.Getenv), GatePID: int64(os.Getpid())},
		GateID:     "gate-" + hex.EncodeToString(gateID[:]),
		Measure:    e.Measure,
		Log:        log,
		Top:        load.TopProcessText,
		Now:        e.Now,
		Sleep:      e.Sleep,
	}
	cfg.BudgetMemoryPct, _ = strconv.Atoi(strings.TrimSpace(e.Getenv("CRSP_BUDGET_MEMORY_PCT")))
	cfg.BudgetCPUPct, _ = strconv.Atoi(strings.TrimSpace(e.Getenv("CRSP_BUDGET_CPU_PCT")))
	if cfg.Measure == nil {
		s := &load.Sampler{Probe: load.NewProbe(), CachePath: load.DefaultCachePath()}
		cfg.Measure = s.Sample
	}
	// The gate settings come from the agent when it answers (flag and env still win, R5.5).
	if cfg.Client != nil {
		if h, err := cfg.Client.Hello(ctx); err == nil {
			cfg.Gate = slots.ResolveGate(*maxWait, *poll, *onTimeout, e.Getenv, h.Settings)
		}
	}
	cfg.Report, cfg.Healthy = e.reporter("job-started")
	return RunGate(ctx, cfg)
}

func runCompleted(ctx context.Context, args []string, e Env) int {
	fs := flag.NewFlagSet("job-completed", flag.ContinueOnError)
	fs.SetOutput(e.Stderr)
	keep := fs.Bool("keep-work", false, "do not empty the work folder")
	logPath := fs.String("log", defaultLogPath(e.Getenv), "agent log file")
	if err := fs.Parse(args); err != nil {
		// Even a bad flag never fails a finished job (R5.30).
		_, _ = fmt.Fprintln(e.Stderr, "job-completed:", err)
	}
	report, healthy := e.reporter("job-completed")
	return RunJobDone(ctx, DoneConfig{
		Client: e.client(), Job: jobFromEnv(e.Getenv), Workspace: e.Getenv("GITHUB_WORKSPACE"), KeepWork: *keep,
		Log: e.logger(*logPath), Report: report, Healthy: healthy,
	})
}
