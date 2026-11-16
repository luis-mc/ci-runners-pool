package machines

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/dockercompact"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

// The Docker disk compact policy (caches R5.51 to R5.54, machines R5.66). On Windows,
// Docker Desktop keeps its data in a WSL2 disk file that grows and never
// shrinks. The controller compacts it by itself, through the maintain path:
// hold the machine, drain it, run `docker-compact`, release it.

// Compact modes. An empty mode is automatic: on for a Windows machine whose
// agent reported a Docker Desktop disk file, off for the others.
const (
	CompactAuto = ""
	CompactOn   = "on"
	CompactOff  = "off"
)

// Defaults of the policy.
const (
	DefaultCompactThresholdGiB = 30
	DefaultCompactIdleMinutes  = 30
	DefaultCompactQuietStart   = "01:00"
	DefaultCompactQuietEnd     = "06:00"
	// CompactMinGap is the least time between two compacts of one machine.
	CompactMinGap = 24 * time.Hour
	// CompactCommandTimeout bounds the helper on the agent.
	CompactCommandTimeout = 3 * time.Hour
)

// Skip reasons of a compact decision. The names are read by the console and the
// CLI: do not rename them.
const (
	CompactRun          = "run"
	CompactSkipOff      = "off"
	CompactSkipOffline  = "offline"
	CompactSkipState    = "not_active"
	CompactSkipNoReport = "no_report"
	CompactSkipNoAdmin  = "no_admin"
	CompactSkipBelow    = "below_threshold"
	CompactSkipQuiet    = "outside_quiet_hours"
	CompactSkipBusy     = "busy"
	CompactSkipIdle     = "not_idle_long_enough"
	CompactSkipToday    = "done_today"
	CompactSkipRunning  = "already_running"
	CompactSkipChange   = "change_open"
)

// DockerDisk is what the agent last reported about Docker's disk file.
type DockerDisk struct {
	// Reported is false until the first report that carries the field.
	Reported   bool
	Present    bool
	Files      []string
	FileBytes  int64
	UsedKnown  bool
	UsedBytes  int64
	CanCompact bool
	// UTCOffset is the machine's local offset from UTC.
	UTCOffset  time.Duration
	ReportedAt time.Time
}

// Reclaimable is the file size minus what Docker uses; 0 when not known.
func (d DockerDisk) Reclaimable() int64 {
	if !d.Present || !d.UsedKnown || d.FileBytes <= d.UsedBytes {
		return 0
	}
	return d.FileBytes - d.UsedBytes
}

// CompactPolicy is the policy with its defaults filled in.
type CompactPolicy struct {
	Mode           string
	ThresholdBytes int64
	Idle           time.Duration
	// QuietStart and QuietEnd are minutes after local midnight.
	QuietStart, QuietEnd int
}

// EffectiveCompact fills the defaults of the compact settings.
func (s Settings) EffectiveCompact() CompactPolicy {
	p := CompactPolicy{Mode: s.CompactMode, ThresholdBytes: int64(s.CompactThresholdGiB) << 30, Idle: time.Duration(s.CompactIdleMinutes) * time.Minute}
	if s.CompactThresholdGiB <= 0 {
		p.ThresholdBytes = int64(DefaultCompactThresholdGiB) << 30
	}
	if s.CompactIdleMinutes <= 0 {
		p.Idle = DefaultCompactIdleMinutes * time.Minute
	}
	start, end := s.CompactQuietStart, s.CompactQuietEnd
	if start == "" {
		start = DefaultCompactQuietStart
	}
	if end == "" {
		end = DefaultCompactQuietEnd
	}
	p.QuietStart, _ = parseClock(start)
	p.QuietEnd, _ = parseClock(end)
	return p
}

// Enabled says whether the policy is on for a machine of this OS.
func (p CompactPolicy) Enabled(os string, d DockerDisk) bool {
	switch p.Mode {
	case CompactOn:
		return true
	case CompactOff:
		return false
	}
	return os == "windows" && d.Present
}

// InQuietHours says whether the machine's local time is inside the window. A
// window that ends before it starts crosses midnight.
func (p CompactPolicy) InQuietHours(now time.Time, offset time.Duration) bool {
	local := now.UTC().Add(offset)
	min := local.Hour()*60 + local.Minute()
	switch {
	case p.QuietStart == p.QuietEnd:
		return true
	case p.QuietStart < p.QuietEnd:
		return min >= p.QuietStart && min < p.QuietEnd
	default:
		return min >= p.QuietStart || min < p.QuietEnd
	}
}

// parseClock reads "HH:MM" into minutes after midnight.
func parseClock(s string) (int, bool) {
	h, m, ok := strings.Cut(strings.TrimSpace(s), ":")
	if !ok {
		return 0, false
	}
	hh, err1 := strconv.Atoi(h)
	mm, err2 := strconv.Atoi(m)
	if err1 != nil || err2 != nil || len(h) != 2 || len(m) != 2 || hh < 0 || hh > 23 || mm < 0 || mm > 59 {
		return 0, false
	}
	return hh*60 + mm, true
}

// validateCompact checks the ranges of the compact settings (caches R5.51 to R5.54).
func validateCompact(set Settings) error {
	bad := func(format string, a ...any) error {
		return fmt.Errorf("%w: %s", ErrInvalid, fmt.Sprintf(format, a...))
	}
	switch set.CompactMode {
	case CompactAuto, CompactOn, CompactOff:
	default:
		return bad("the Docker disk compact is on, off or automatic")
	}
	if set.CompactThresholdGiB < 0 || set.CompactThresholdGiB > 100000 {
		return bad("the compact threshold is 1 GiB to 100000 GiB")
	}
	if set.CompactIdleMinutes < 0 || set.CompactIdleMinutes > 1440 {
		return bad("the compact idle time is 1 minute to 24 hours")
	}
	for _, c := range []string{set.CompactQuietStart, set.CompactQuietEnd} {
		if c == "" {
			continue
		}
		if _, ok := parseClock(c); !ok {
			return bad("a quiet-hours time is written HH:MM, such as 01:00")
		}
	}
	return nil
}

func applyCompact(set Settings, u SettingsUpdate) Settings {
	if u.CompactMode != nil {
		set.CompactMode = *u.CompactMode
	}
	if u.CompactThresholdGiB != nil {
		set.CompactThresholdGiB = *u.CompactThresholdGiB
	}
	if u.CompactIdleMinutes != nil {
		set.CompactIdleMinutes = *u.CompactIdleMinutes
	}
	if u.CompactQuietStart != nil {
		set.CompactQuietStart = *u.CompactQuietStart
	}
	if u.CompactQuietEnd != nil {
		set.CompactQuietEnd = *u.CompactQuietEnd
	}
	return set
}

// CompactInput is everything one decision reads.
type CompactInput struct {
	Now      time.Time
	OS       string
	Online   bool
	State    string
	Settings Settings
	Disk     DockerDisk
	// Running and Queued count the jobs on the machine's runners.
	Running, Queued int
	// IdleSince is the last time a job ran or waited here; zero when not known.
	IdleSince time.Time
	LastAt    time.Time
	// Open is a change or a compact that already holds the machine.
	Open, Compacting bool
}

// CompactDecision is the answer: Reason is CompactRun or a skip reason.
type CompactDecision struct {
	Run    bool
	Reason string
}

// DecideCompact says whether to compact now (caches R5.51 to R5.54). The order of the
// checks is the order of the reasons the console shows.
func DecideCompact(in CompactInput) CompactDecision {
	no := func(reason string) CompactDecision { return CompactDecision{Reason: reason} }
	p := in.Settings.EffectiveCompact()
	switch {
	case !p.Enabled(in.OS, in.Disk):
		return no(CompactSkipOff)
	case !in.Online:
		return no(CompactSkipOffline)
	case in.Compacting:
		return no(CompactSkipRunning)
	case in.State != StateActive:
		return no(CompactSkipState)
	case in.Open:
		return no(CompactSkipChange)
	case !in.Disk.Reported:
		return no(CompactSkipNoReport)
	}
	if in.OS == "windows" {
		switch {
		case !in.Disk.Present:
			return no(CompactSkipNoReport)
		case !in.Disk.CanCompact:
			return no(CompactSkipNoAdmin)
		case in.Disk.Reclaimable() < p.ThresholdBytes:
			return no(CompactSkipBelow)
		}
	}
	switch {
	case !p.InQuietHours(in.Now, in.Disk.UTCOffset):
		return no(CompactSkipQuiet)
	case !in.LastAt.IsZero() && in.Now.Sub(in.LastAt) < CompactMinGap:
		return no(CompactSkipToday)
	case in.Running > 0 || in.Queued > 0:
		return no(CompactSkipBusy)
	case in.IdleSince.IsZero() || in.Now.Sub(in.IdleSince) < p.Idle:
		return no(CompactSkipIdle)
	}
	return CompactDecision{Run: true, Reason: CompactRun}
}

// QueueSource tells how many jobs wait for a machine's runners and which
// repositories use it. A nil source reads as "nothing queued, no project known".
type QueueSource interface {
	QueuedFor(ctx context.Context, machineID string) (queued int, repositories []string, err error)
}

// CompactNotice is the text of a notice to the projects that use a machine.
type CompactNotice struct {
	Phase        string // before, after or failed
	MachineName  string
	Repositories []string
	// FileBefore and FileAfter are the disk file size; Used is what Docker uses.
	FileBefore, FileAfter, Used int64
	Message                     string
}

// Notice phases.
const (
	NoticeBefore = "before"
	NoticeAfter  = "after"
	NoticeFailed = "failed"
)

// Text writes the notice for people.
func (n CompactNotice) Text() string {
	b := func(v int64) string { return dockercompact.FormatBytes(v) }
	switch n.Phase {
	case NoticeBefore:
		return fmt.Sprintf("%s is making Docker's disk smaller (%s on disk, %s used). New jobs wait in the queue and start again when it is done; no job is stopped.", n.MachineName, b(n.FileBefore), b(n.Used))
	case NoticeAfter:
		return fmt.Sprintf("%s made Docker's disk smaller: %s to %s. Jobs take the machine again.", n.MachineName, b(n.FileBefore), b(n.FileAfter))
	default:
		return fmt.Sprintf("%s could not make Docker's disk smaller: %s. Jobs take the machine again.", n.MachineName, n.Message)
	}
}

// CompactNotifier is an optional part of a Notifier: it is told before and
// after a compact, so the projects that use the machine get a notice (the same
// path as the drain alerts, R5.33, R5.56).
type CompactNotifier interface {
	CompactNotice(machineID string, n CompactNotice)
}

// CompactStatus is what the console shows about the policy of one machine.
type CompactStatus struct {
	Enabled bool
	// Reason is the skip reason of the last decision, or run.
	Reason     string
	Disk       DockerDisk
	LastAt     time.Time
	LastResult string
	Running    bool
}

type compactState struct {
	lastBusy   time.Time
	lastAt     time.Time
	lastResult string
	running    bool
	reason     string
}

type compactBook struct {
	mu sync.Mutex
	m  map[string]*compactState
	wg sync.WaitGroup
	// poll is how often the drain is checked while the compact waits for it.
	poll time.Duration
}

func (b *compactBook) get(id string) *compactState {
	if b.m == nil {
		b.m = map[string]*compactState{}
	}
	st, ok := b.m[id]
	if !ok {
		st = &compactState{}
		b.m[id] = st
	}
	return st
}

// noteBusy remembers that a job ran or waited on the machine now.
func (s *Service) noteBusy(id string) {
	s.compact.mu.Lock()
	s.compact.get(id).lastBusy = s.now()
	s.compact.mu.Unlock()
}

// SetQueueSource sets where queued jobs come from; call it before the service runs.
func (s *Service) SetQueueSource(q QueueSource) {
	s.compact.mu.Lock()
	s.queue = q
	s.compact.mu.Unlock()
}

// SetCompactPoll sets how often a compact checks its drain (tests make it short).
func (s *Service) SetCompactPoll(d time.Duration) {
	s.compact.mu.Lock()
	s.compact.poll = d
	s.compact.mu.Unlock()
}

// HandleDockerDisk stores the Docker disk report of an agent.
func (s *Service) HandleDockerDisk(machineID string, r *agentv1.DockerDiskReport) {
	if r == nil {
		return
	}
	d := DockerDisk{
		Reported: true, Present: r.GetPresent(), Files: r.GetFiles(), FileBytes: r.GetFileBytes(), UsedKnown: r.GetUsedKnown(),
		UsedBytes: r.GetUsedBytes(), CanCompact: r.GetCanCompact(), UTCOffset: time.Duration(r.GetUtcOffsetSeconds()) * time.Second, ReportedAt: s.now(),
	}
	s.mu.Lock()
	old := s.disks[machineID]
	s.disks[machineID] = d
	s.mu.Unlock()
	if old.Present != d.Present || old.CanCompact != d.CanCompact || old.FileBytes != d.FileBytes || old.UsedBytes != d.UsedBytes {
		s.notifyMachine(machineID)
	}
}

// DockerDisk returns the newest report of a machine.
func (s *Service) DockerDisk(machineID string) DockerDisk {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.disks[machineID]
}

// CompactStatus is the policy state the console shows for a machine.
func (s *Service) CompactStatus(m Machine, set Settings) CompactStatus {
	d := s.DockerDisk(m.ID)
	s.compact.mu.Lock()
	st := *s.compact.get(m.ID)
	s.compact.mu.Unlock()
	return CompactStatus{
		Enabled: set.EffectiveCompact().Enabled(m.OS, d), Reason: st.reason, Disk: d,
		LastAt: st.lastAt, LastResult: st.lastResult, Running: st.running,
	}
}

// CompactPass looks at every machine once and starts a compact where the policy
// says so. Each compact runs in its own goroutine (it can last an hour); a test
// waits for them with WaitCompact. It returns the decision per machine id.
func (s *Service) CompactPass(ctx context.Context) (map[string]CompactDecision, error) {
	ms, err := s.o.Repo.ListMachines(ctx)
	if err != nil {
		return nil, err
	}
	out := map[string]CompactDecision{}
	for _, m := range ms {
		set, err := s.o.Repo.GetSettings(ctx, m.ID)
		if err != nil {
			return out, err
		}
		in := s.compactInput(ctx, m, set)
		dec := DecideCompact(in)
		s.compact.mu.Lock()
		s.compact.get(m.ID).reason = dec.Reason
		s.compact.mu.Unlock()
		out[m.ID] = dec
		if !dec.Run {
			continue
		}
		s.compact.mu.Lock()
		s.compact.get(m.ID).running = true
		s.compact.wg.Add(1)
		s.compact.mu.Unlock()
		go func(id string) {
			defer s.compact.wg.Done()
			// The compact outlives the pass that started it.
			_, _ = s.CompactMachine(context.WithoutCancel(ctx), "system", id)
		}(m.ID)
	}
	return out, nil
}

// WaitCompact waits for the compacts a pass started.
func (s *Service) WaitCompact() { s.compact.wg.Wait() }

func (s *Service) compactInput(ctx context.Context, m Machine, set Settings) CompactInput {
	now := s.now()
	running := len(s.runningJobs(m.ID))
	queued := 0
	s.compact.mu.Lock()
	q := s.queue
	s.compact.mu.Unlock()
	if q != nil {
		if n, _, err := q.QueuedFor(ctx, m.ID); err == nil {
			queued = n
		} else {
			// Not knowing the queue is not idle.
			queued = 1
		}
	}
	s.compact.mu.Lock()
	st := s.compact.get(m.ID)
	if running > 0 || queued > 0 || st.lastBusy.IsZero() {
		// The first look counts as busy: the idle time starts when the
		// controller first sees the machine, never earlier.
		st.lastBusy = now
	}
	in := CompactInput{
		Now: now, OS: m.OS, Online: m.Online, State: m.State, Settings: set, Disk: s.diskLocked(m.ID),
		Running: running, Queued: queued, IdleSince: st.lastBusy, LastAt: st.lastAt, Compacting: st.running,
	}
	s.compact.mu.Unlock()
	if _, open, err := s.o.Repo.OpenChange(ctx, m.ID); err != nil || open {
		in.Open = true
	}
	return in
}

func (s *Service) diskLocked(id string) DockerDisk {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.disks[id]
}

// CompactOutcome is what CompactMachine did.
type CompactOutcome struct {
	Report dockercompact.Report
	OK     bool
	// Released is false when the hold could not be lifted.
	Released bool
	Message  string
}

// RunCompactLoop runs CompactPass every interval until ctx ends.
func (s *Service) RunCompactLoop(ctx context.Context, interval time.Duration, onErr func(error)) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			s.WaitCompact()
			return
		case <-t.C:
			if _, err := s.CompactPass(ctx); err != nil && onErr != nil {
				onErr(err)
			}
		}
	}
}

// ErrCompactBusy is returned when the machine is not free to compact.
var ErrCompactBusy = errors.New("a compact or a change already holds this machine")

// CompactMachine is the maintain path (cli R5.29) for the Docker disk: notice,
// drain, wait until drained, run `docker-compact` on the agent, always release,
// notice, audit. A job queued meanwhile waits in the queue; nothing is stopped.
// The machine is released also when the drain wait or the command fails.
func (s *Service) CompactMachine(ctx context.Context, actor, id string) (CompactOutcome, error) {
	m, err := s.o.Repo.GetMachine(ctx, id)
	if err != nil {
		return CompactOutcome{}, err
	}
	set, err := s.o.Repo.GetSettings(ctx, id)
	if err != nil {
		return CompactOutcome{}, err
	}
	s.compact.mu.Lock()
	st := s.compact.get(id)
	st.running = true
	s.compact.mu.Unlock()
	finish := func(result string, stamp bool) {
		s.compact.mu.Lock()
		st := s.compact.get(id)
		st.running, st.lastResult = false, result
		if stamp {
			st.lastAt = s.now()
		}
		s.compact.mu.Unlock()
		s.notifyMachine(id)
	}
	disk := s.DockerDisk(id)
	_, repos := s.queuedRepos(ctx, id)
	repos = mergeRepos(repos, s.runningRepos(id))
	notice := func(n CompactNotice) {
		n.MachineName, n.Repositories = m.Name, repos
		if c, ok := s.o.Notify.(CompactNotifier); ok {
			c.CompactNotice(id, n)
		}
	}
	_ = s.o.Repo.Audit(ctx, actor, "machine.compact.start", id,
		fmt.Sprintf("file %s, used %s", dockercompact.FormatBytes(disk.FileBytes), dockercompact.FormatBytes(disk.UsedBytes)))
	notice(CompactNotice{Phase: NoticeBefore, FileBefore: disk.FileBytes, Used: disk.UsedBytes})

	fail := func(msg string, released bool) (CompactOutcome, error) {
		_ = s.o.Repo.Audit(ctx, actor, "machine.compact.failed", id, msg)
		notice(CompactNotice{Phase: NoticeFailed, Message: msg, FileBefore: disk.FileBytes})
		finish("failed: "+msg, true)
		return CompactOutcome{Message: msg, Released: released}, errors.New(msg)
	}
	release := func() bool {
		// Ctrl-C and shutdown never keep the machine held.
		rctx := context.WithoutCancel(ctx)
		if _, err := s.Resume(rctx, actor, id, true); err != nil {
			_ = s.o.Repo.Audit(rctx, actor, "machine.compact.release_failed", id, err.Error())
			return false
		}
		return true
	}

	if _, err := s.Drain(ctx, actor, id, "docker disk compact"); err != nil {
		if errors.Is(err, ErrConflict) {
			finish("skipped: "+err.Error(), false)
			_ = s.o.Repo.Audit(ctx, actor, "machine.compact.skipped", id, err.Error())
			return CompactOutcome{Message: err.Error()}, ErrCompactBusy
		}
		return fail("could not hold the machine: "+err.Error(), true)
	}
	if err := s.waitDrained(ctx, id, time.Duration(set.DrainTimeoutMinutes)*time.Minute); err != nil {
		ok := release()
		return fail("the machine did not drain: "+err.Error(), ok)
	}
	out, err := s.RunHostCommand(ctx, actor, id, []string{dockercompact.Command}, CompactCommandTimeout)
	released := release()
	rep, parsed := dockercompact.ParseReport(out.Output)
	switch {
	case err != nil:
		return fail("the command did not run: "+err.Error(), released)
	case !out.OK:
		msg := strings.TrimSpace(out.Message)
		if parsed && rep.Error != "" {
			msg = rep.Error
		}
		if msg == "" {
			msg = fmt.Sprintf("exit code %d", out.ExitCode)
		}
		return fail(msg, released)
	}
	if !released {
		_ = s.o.Repo.Audit(ctx, actor, "machine.compact.release_failed", id, "the hold was not lifted: crsp machine resume "+m.Name)
	}
	result := fmt.Sprintf("%s to %s", dockercompact.FormatBytes(rep.FileBefore()), dockercompact.FormatBytes(rep.FileAfter()))
	_ = s.o.Repo.Audit(ctx, actor, "machine.compact.done", id, result)
	notice(CompactNotice{Phase: NoticeAfter, FileBefore: rep.FileBefore(), FileAfter: rep.FileAfter(), Used: rep.UsedAfter})
	finish(result, true)
	return CompactOutcome{Report: rep, OK: true, Released: released, Message: result}, nil
}

func (s *Service) waitDrained(ctx context.Context, id string, limit time.Duration) error {
	if limit <= 0 {
		limit = time.Duration(DefaultSettings().DrainTimeoutMinutes) * time.Minute
	}
	s.compact.mu.Lock()
	poll := s.compact.poll
	s.compact.mu.Unlock()
	if poll <= 0 {
		poll = 5 * time.Second
	}
	deadline := time.Now().Add(limit)
	for {
		m, err := s.o.Repo.GetMachine(ctx, id)
		if err != nil {
			return err
		}
		if m.State == StateDrained {
			return nil
		}
		if !m.Online {
			return errors.New("the machine went offline")
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("it still ran jobs after %d minutes", int(limit.Minutes()))
		}
		t := time.NewTimer(poll)
		select {
		case <-ctx.Done():
			t.Stop()
			return ctx.Err()
		case <-t.C:
		}
	}
}

func (s *Service) queuedRepos(ctx context.Context, id string) (int, []string) {
	s.compact.mu.Lock()
	q := s.queue
	s.compact.mu.Unlock()
	if q == nil {
		return 0, nil
	}
	n, repos, err := q.QueuedFor(ctx, id)
	if err != nil {
		return 0, nil
	}
	return n, repos
}

func (s *Service) runningRepos(id string) []string {
	var out []string
	for _, j := range s.runningJobs(id) {
		out = append(out, j.Repository)
	}
	return out
}

func mergeRepos(a, b []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, r := range append(append([]string(nil), a...), b...) {
		if r != "" && !seen[r] {
			seen[r] = true
			out = append(out, r)
		}
	}
	return out
}
