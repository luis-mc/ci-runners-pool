package update

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

// The Windows update (operations R5.35). The service runs as LocalSystem, so
// the controller starts `msiexec /i <msi> /qn /norestart /l*v <log>` itself,
// detached. The MSI upgrade stops every process that runs from the install
// folder, crsp.exe included, so that path ends there: no helper waits for the
// result. After the service restarts it reads the log and the version, reports,
// and applies the retry rule (three tries per version).

// MSILogFile is the msiexec log name.
const MSILogFile = "msi-update.log"

// PendingMSIFile records an MSI install the controller started.
const PendingMSIFile = "pending-msi.json"

// MSILogPath is %ProgramData%\crsp\logs\msi-update.log.
func MSILogPath() string {
	pd := os.Getenv("ProgramData")
	if pd == "" {
		pd = `C:\ProgramData`
	}
	return filepath.Join(pd, "crsp", "logs", MSILogFile)
}

// MSIArgs are the msiexec arguments of an update.
func MSIArgs(msi, log string) []string {
	return []string{"/i", msi, "/qn", "/norestart", "/l*v", log}
}

// PendingMSI is what the controller leaves for the next start to read.
type PendingMSI struct {
	From      string    `json:"from"`
	To        string    `json:"to"`
	File      string    `json:"file"`
	Log       string    `json:"log"`
	StartedAt time.Time `json:"started_at"`
}

var mainEngine = regexp.MustCompile(`MainEngineThread is returning (-?\d+)`)

// ParseMSILog reads the installer's exit code from a verbose msiexec log
// ("MainEngineThread is returning N"). ok is false while the log has no such
// line (the install has not ended, or the log is missing). Logs may be UTF-16.
func ParseMSILog(b []byte) (code int, ok bool) {
	s := decodeLog(b)
	m := mainEngine.FindAllStringSubmatch(s, -1)
	if len(m) == 0 {
		return 0, false
	}
	n, err := strconv.Atoi(m[len(m)-1][1])
	if err != nil {
		return 0, false
	}
	return n, true
}

func decodeLog(b []byte) string {
	if len(b) >= 2 && b[0] == 0xFF && b[1] == 0xFE {
		u := make([]uint16, 0, len(b)/2)
		for i := 2; i+1 < len(b); i += 2 {
			u = append(u, uint16(b[i])|uint16(b[i+1])<<8)
		}
		return string(utf16.Decode(u))
	}
	return strings.ReplaceAll(string(b), "\x00", "")
}

// startMSI starts the installer detached and leaves the pending record. After
// it returns nil the MSI is about to stop this service.
func (m *Manager) startMSI(ctx context.Context, p *pending) (int, error) {
	logp := m.o.MSILog
	if logp == "" {
		logp = MSILogPath()
	}
	if err := os.MkdirAll(filepath.Dir(logp), 0o750); err != nil {
		return 0, err
	}
	_ = os.Remove(logp) // an old log would hide this run's result
	rec := PendingMSI{From: m.o.Current, To: p.version, File: p.file, Log: logp, StartedAt: m.o.Now()}
	if err := writeJSON(filepath.Join(m.o.Dir, PendingMSIFile), rec); err != nil {
		return 0, err
	}
	pid, err := m.o.StartMSI(ctx, p.file, logp)
	if err != nil {
		_ = os.Remove(filepath.Join(m.o.Dir, PendingMSIFile))
		return 0, fmt.Errorf("could not start the installer: %w", err)
	}
	return pid, nil
}

// RecoverMSI settles a pending MSI install after a start: success when the
// running version is the target, failure when the log shows a bad exit code,
// failure when the log never got an end line after LockMaxAge. A log that is
// still running is left alone. It writes the Result and the failure count, and
// returns true when it settled something.
func RecoverMSI(dir, current string, now time.Time) bool {
	settled, _ := recoverMSI(dir, current, now)
	return settled
}

// recoverMSI is RecoverMSI that also hands back the Result it wrote.
func recoverMSI(dir, current string, now time.Time) (bool, Result) {
	var rec PendingMSI
	b, err := os.ReadFile(filepath.Join(dir, PendingMSIFile)) //nolint:gosec // work folder
	if err != nil || json.Unmarshal(b, &rec) != nil {
		return false, Result{}
	}
	done := func(r Result) (bool, Result) {
		r.Kind, r.From, r.To, r.At = "update", rec.From, rec.To, now
		prev, _ := ReadStage(dir) // the attempt that started this install (CRSP205)
		r.Attempt = prev.Attempt
		_ = WriteResult(dir, r)
		st := Stage{Name: StageDone, Percent: 100, Version: rec.To, At: now}
		if !r.OK {
			st = Stage{Name: StageFailed, Percent: -1, Version: rec.To, Error: r.Error, LogPath: rec.Log, FailedAt: StageInstalling, At: now}
		}
		st.StartedBy, st.Attempt, st.AttemptKind, st.AttemptStarted = prev.StartedBy, prev.Attempt, prev.AttemptKind, prev.AttemptStarted
		_ = WriteStage(dir, st)
		_ = os.Remove(filepath.Join(dir, PendingMSIFile))
		return true, r
	}
	if current == rec.To {
		_ = clearFailures(dir, rec.To)
		return done(Result{OK: true})
	}
	lb, _ := os.ReadFile(rec.Log) //nolint:gosec // our own log
	code, ok := ParseMSILog(lb)
	switch {
	case ok && msiOK(code):
		// The installer says it worked but the old version still runs: the service did not come back as the new build.
		_ = RecordFailure(dir, rec.To, now, false)
		return done(Result{Error: fmt.Sprintf("the installer finished (exit code %d) but this is still version %s. The log is %s", code, current, rec.Log)})
	case ok:
		_ = RecordFailure(dir, rec.To, now, false)
		return done(Result{Error: fmt.Sprintf("the installer failed with exit code %d; the old version stays (Windows Installer rolled back). The log is %s", code, rec.Log)})
	case now.Sub(rec.StartedAt) > LockMaxAge:
		_ = RecordFailure(dir, rec.To, now, false)
		return done(Result{Error: "the installer left no result in its log. The log is " + rec.Log})
	}
	return false, Result{}
}

// followMSILog writes the install percent into the stage file while the installer
// runs and this service still lives (the upgrade stops it part way; the next
// start settles the result). It ends when the log has its end line.
func (m *Manager) followMSILog(version string) {
	logp := m.o.MSILog
	if logp == "" {
		logp = MSILogPath()
	}
	last := -1
	deadline := m.o.Now().Add(LockMaxAge)
	for m.o.Now().Before(deadline) {
		time.Sleep(time.Second)
		b, err := os.ReadFile(logp) //nolint:gosec // our own log
		if err != nil {
			continue
		}
		pc := MSIPercent(b)
		if pc != last {
			last = pc
			if pc >= 100 {
				m.stage(Stage{Name: StageRestarting, Percent: -1, Version: version})
				return
			}
			m.stage(Stage{Name: StageInstalling, Percent: pc, Version: version, LogPath: logp})
		}
	}
}

func clearFailures(dir, version string) error {
	if f, _ := ReadFailures(dir); f.Version == version {
		return os.Remove(filepath.Join(dir, FailuresFile))
	}
	return nil
}
