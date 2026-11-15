package container

import (
	"context"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/images"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
)

// Errors of the pool lifecycle.
var (
	// ErrDraining means the pool takes no new runner while it waits to swap its
	// image. The controller asks again after the swap (runners R5.35, R6.4).
	ErrDraining = errors.New("the pool container is draining for an image swap; no new runner starts")
	// ErrNeedsJIT is returned when a runner is started with a registration
	// token: a container runner is ephemeral and takes a JIT config (R5.25).
	ErrNeedsJIT = errors.New("a container runner is ephemeral and needs a JIT config")
)

// Config is what the backend is built with.
type Config struct {
	// Dockerfile and BuildContext build the base image (images/linux-base)
	// from a folder that is already there. They win over Assets.
	Dockerfile   string
	BuildContext string
	// Assets holds the image files (the images/ folder of the repository,
	// embedded in the binary). Before a build they are written to a folder of
	// their own under BuildRoot, with the crsp binary, and removed after it
	// (runners R5.33, open question 36).
	Assets    fs.FS
	BuildRoot string
	// BaseName names the base image in the image key.
	BaseName string
	// Pins are the pinned tool versions in the image key, such as the Actions
	// runner (runners R5.33, R5.37).
	Pins map[string]string
	// Limits are the caps of a pool container when the runner spec carries
	// none; the pool size of the machine in the spec wins (runners R5.27).
	Limits Limits
	// KVM is true when the machine allows /dev/kvm for the pool and the agent
	// checked it works (runners R5.27, R5.41).
	KVM bool
	// CrspHostPath is the agent's linux binary for the read-only mount.
	CrspHostPath string
	// CacheRoot is the machine's cache folder; the lanes of every repository
	// live under it (caches R5.43). Empty means no pool takes a lane.
	CacheRoot string
	// KVMProbe reads /dev/kvm; nil means the machine has none to give. The
	// device is passed only when the pool has the kvm layer (runners R5.41).
	KVMProbe func() KVMFacts
	// KVMWaitInterval and KVMWaitBound bound the wait for /dev/kvm (defaults
	// 2 s and 60 s).
	KVMWaitInterval, KVMWaitBound time.Duration
	// OpenSecrets opens the store of the Postgres passwords; Database replaces
	// the whole Postgres (tests). With neither, a repository that declares a
	// database cannot start (ErrNoDatabase).
	OpenSecrets func(ctx context.Context) (secrets.Store, error)
	Database    func(ctx context.Context, pool string) (Database, error)
	// StopGrace is the time `docker stop` gives the idle container.
	StopGrace time.Duration
}

// Backend is the container backend. One pool container per repository holds
// the ephemeral runners of its jobs.
type Backend struct {
	d   sys.Deps
	eng Engine
	cfg Config

	mu        sync.Mutex
	draining  map[string]bool   // pool name -> a swap waits for idle
	dbRunners map[string]string // runner ref -> runner id, for runners that got a database
	owners    runners.MemoryRoleOwners
}

var _ backend.Backend = (*Backend)(nil)

// New builds the backend over an engine.
func New(d sys.Deps, eng Engine, cfg Config) *Backend {
	if cfg.StopGrace <= 0 {
		cfg.StopGrace = 30 * time.Second
	}
	return &Backend{d: d, eng: eng, cfg: cfg, draining: map[string]bool{}, dbRunners: map[string]string{}}
}

// Name implements backend.Backend.
func (b *Backend) Name() backend.Name { return backend.Docker }

// Detect implements backend.Backend. It reads the engine and edits nothing.
func (b *Backend) Detect(ctx context.Context) (backend.Support, error) {
	st, err := b.eng.Detect(ctx)
	if err != nil {
		return backend.Support{}, err
	}
	return backend.Support{Name: backend.Docker, Present: st.Present, Usable: st.Usable, Version: st.Version,
		Reason: st.Reason, Isolation: backend.IsolationContainer, OS: []string{"linux"}}, nil
}

var safeName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`)

// ownerRepo reads owner and repo from https://github.com/<owner>/<repo>. A
// container pool belongs to one repository, so an organization URL is refused.
func ownerRepo(url string) (owner, repo string, err error) {
	u := strings.TrimSuffix(strings.TrimPrefix(strings.TrimPrefix(url, "https://"), "http://"), "/")
	parts := strings.Split(u, "/")
	if len(parts) != 3 || parts[1] == "" || parts[2] == "" {
		return "", "", fmt.Errorf("a pool container belongs to one repository; %q is not a repository URL", url)
	}
	return parts[1], parts[2], nil
}

func jobDir(name string) string  { return JobsDir + "/" + name }
func jitFile(name string) string { return JITDir + "/" + name + ".jit" }

// runnerScript reads the JIT config from its file, deletes the file, then
// starts the runner with the config in its environment only. The config is
// never in an argument, so `ps` and the engine's inspect do not show it.
const runnerScript = `f="$1"; c=$(cat "$f") || exit 1; rm -f "$f"; ACTIONS_RUNNER_INPUT_JITCONFIG="$c"; export ACTIONS_RUNNER_INPUT_JITCONFIG; unset c; exec ./run.sh >runner.log 2>&1`

// Start implements backend.Backend: it makes sure the pool container of the
// repository runs, gives the runner its own folder, hands the JIT config over
// through a file only the job user can read, and starts the runner. The runner
// takes one job and exits (runners R5.25).
func (b *Backend) Start(ctx context.Context, r backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error) {
	b.learn(cfg.JITConfig, cfg.Registration, cfg.Removal)
	if cfg.JITConfig == "" {
		return backend.Handle{}, ErrNeedsJIT
	}
	if r.OS != "" && r.OS != "linux" {
		return backend.Handle{}, fmt.Errorf("the container backend runs Linux jobs only, not %s", r.OS)
	}
	if !safeName.MatchString(r.Name) {
		return backend.Handle{}, fmt.Errorf("runner name %q cannot be used in a container", r.Name)
	}
	owner, repo, err := ownerRepo(r.GitHubURL)
	if err != nil {
		return backend.Handle{}, err
	}
	pool := PoolName(owner, repo)
	h := backend.Handle{RunnerID: r.ID, Ref: pool + ":" + r.Name}

	b.mu.Lock()
	defer b.mu.Unlock()
	if b.draining[pool] {
		return h, ErrDraining
	}
	kvm := b.kvmFacts(ctx, runners.NormalizeLayers(r.Pool.Layers))
	plan, err := PlanPool(b.cfg, r, owner, repo, kvm)
	if err != nil {
		return h, err
	}
	if plan.KVMNote != "" {
		b.log("start", "no KVM device for "+pool+": "+plan.KVMNote)
	}
	var db Database
	if plan.Database != nil {
		if db, err = b.database(ctx, pool); err != nil {
			return h, err
		}
		if err := db.EnsureServer(ctx); err != nil {
			return h, fmt.Errorf("database server: %s", b.redact(err.Error()))
		}
	}
	if err := b.ensurePool(ctx, plan.Pool); err != nil {
		return h, err
	}
	if db != nil {
		if err := b.connectDB(ctx, pool); err != nil {
			return h, err
		}
	}
	if plan.WinePrefix != "" {
		b.ensureWine(ctx, pool, plan)
	}
	startArgs := []string{"exec", "-d", "-u", JobUser, "-w", jobDir(r.Name)}
	startArgs = append(startArgs, envArgs(plan.RunnerEnv)...)
	startArgs = append(startArgs, pool, "sh", "-c", runnerScript, "sh", jitFile(r.Name))
	steps := []struct {
		step string
		args []string
		in   string
	}{
		{"prepare", []string{"exec", "-u", JobUser, pool, "sh", "-c", `mkdir -p "$1" && cp -a "$2/." "$1/"`, "sh", jobDir(r.Name), RunnerDir}, ""},
	}
	rollback := func() {
		// Do not leave a half-made folder, a config file or a login behind.
		_ = b.cleanUp(ctx, pool, r.Name)
		if db != nil {
			_ = db.Remove(ctx, r.ID)
		}
	}
	for _, s := range steps {
		if err := b.step(ctx, s.step, s.args, s.in); err != nil {
			rollback()
			return h, err
		}
	}
	if db != nil {
		b.dbRunners[h.Ref] = r.ID
		if err := b.provisionDB(ctx, db, pool, owner, repo, r); err != nil {
			rollback()
			return h, err
		}
	}
	for _, s := range []struct {
		step string
		args []string
		in   string
	}{
		{"register", []string{"exec", "-i", "-u", JobUser, pool, "sh", "-c", `umask 077 && cat > "$1"`, "sh", jitFile(r.Name)}, cfg.JITConfig},
		{"start", startArgs, ""},
	} {
		if err := b.step(ctx, s.step, s.args, s.in); err != nil {
			rollback()
			return h, err
		}
	}
	b.log("start", "runner "+r.Name+" started in "+pool)
	return h, nil
}

// step runs one engine call. The error text is redacted first.
func (b *Backend) step(ctx context.Context, step string, args []string, stdin string) error {
	c, err := b.eng.Command(args...)
	if err != nil {
		return err
	}
	c.Stdin = stdin
	res, err := b.d.Cmd.Run(ctx, c)
	if err != nil {
		return fmt.Errorf("%s: %s", step, b.redact(err.Error()))
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("%s failed (exit %d): %s", step, res.ExitCode, b.redact(strings.TrimSpace(res.Stderr)))
	}
	return nil
}

func (b *Backend) run(ctx context.Context, args ...string) (sys.Result, error) {
	return b.eng.Run(ctx, args...)
}

// keyOf reads the image key from an image tag of the form `crsp-pool:<key>`.
func keyOf(tag string) string {
	_, k, _ := strings.Cut(tag, ":")
	return k
}

// poolState reads the state of a pool container: whether it exists, whether it
// runs and which image key it was made from.
func (b *Backend) poolState(ctx context.Context, pool string) (exists, running bool, key string, err error) {
	res, err := b.run(ctx, "inspect", "--format", `{{.State.Running}} {{index .Config.Labels "`+LabelImage+`"}}`, pool)
	if err != nil {
		return false, false, "", err
	}
	if res.ExitCode != 0 {
		if noSuchContainer(res.Stderr) {
			return false, false, "", nil
		}
		return false, false, "", fmt.Errorf("inspect %s: %s", pool, b.redact(strings.TrimSpace(res.Stderr)))
	}
	f := strings.Fields(res.Stdout)
	if len(f) == 0 {
		return false, false, "", fmt.Errorf("inspect %s: no answer", pool)
	}
	if len(f) > 1 {
		key = f[1]
	}
	return true, f[0] == "true", key, nil
}

func noSuchContainer(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "no such container") || strings.Contains(s, "no such object")
}

// ensurePool starts the pool container of a repository when it is not there.
// An existing one is kept as it is, with its image, until a swap (R5.35).
func (b *Backend) ensurePool(ctx context.Context, p PoolSpec) error {
	name := PoolName(p.Owner, p.Repo)
	exists, running, _, err := b.poolState(ctx, name)
	if err != nil {
		return err
	}
	if exists && running {
		return nil
	}
	if exists { // stopped: start it again, same image
		return b.step(ctx, "pool start", []string{"start", name}, "")
	}
	if p.LaneRepoID != "" {
		lane, err := b.takeLane(name, p.LaneRepoID)
		if err != nil {
			return err
		}
		p.Lane = &lane
	}
	args, err := RunArgs(p)
	if err != nil {
		return err
	}
	return b.step(ctx, "pool create", args, "")
}

// Stop implements backend.Backend. Callers drain first and check for an idle
// runner right before (runners R6.4). It signals this runner's listener only.
func (b *Backend) Stop(ctx context.Context, h backend.Handle) error {
	pool, name, ok := splitRef(h.Ref)
	if !ok {
		return fmt.Errorf("bad runner reference %q", h.Ref)
	}
	res, err := b.run(ctx, "exec", pool, "pkill", "-TERM", "-f", jobDir(name)+"/bin/Runner.Listener")
	if err != nil {
		return err
	}
	// pkill exits 1 when nothing matched: the runner already ended.
	if res.ExitCode > 1 {
		if noSuchContainer(res.Stderr) {
			return nil
		}
		return fmt.Errorf("stop: %s", b.redact(strings.TrimSpace(res.Stderr)))
	}
	return nil
}

// CleanUp implements backend.Backend. It removes the runner's folder and any
// config file, so nothing passes to the next job (runners R5.26). It is safe to
// call twice, and when the container is already gone (R5.10).
func (b *Backend) CleanUp(ctx context.Context, h backend.Handle) error {
	pool, name, ok := splitRef(h.Ref)
	if !ok {
		return fmt.Errorf("bad runner reference %q", h.Ref)
	}
	if err := b.cleanUp(ctx, pool, name); err != nil {
		return err
	}
	return b.removeDB(ctx, pool, h)
}

// removeDB drops the login and database of a runner that got one (runners
// R5.54). The declared roles stay. The agent link hands CleanUp the runner ref
// only, so the backend remembers which ref got which login; after an agent
// restart that memory is gone (runners open question 44).
func (b *Backend) removeDB(ctx context.Context, pool string, h backend.Handle) error {
	b.mu.Lock()
	id, has := b.dbRunners[h.Ref]
	b.mu.Unlock()
	if !has {
		return nil
	}
	db, err := b.database(ctx, pool)
	if err != nil {
		return err
	}
	if err := db.Remove(ctx, id); err != nil {
		return fmt.Errorf("database: %s", b.redact(err.Error()))
	}
	b.mu.Lock()
	delete(b.dbRunners, h.Ref)
	b.mu.Unlock()
	return nil
}

func (b *Backend) cleanUp(ctx context.Context, pool, name string) error {
	res, err := b.run(ctx, "exec", pool, "sh", "-c", `rm -rf -- "$1" "$2"`, "sh", jobDir(name), jitFile(name))
	if err != nil {
		return err
	}
	if res.ExitCode != 0 && !noSuchContainer(res.Stderr) && !strings.Contains(strings.ToLower(res.Stderr), "is not running") {
		return fmt.Errorf("clean up: %s", b.redact(strings.TrimSpace(res.Stderr)))
	}
	return nil
}

func splitRef(ref string) (pool, name string, ok bool) {
	pool, name, ok = strings.Cut(ref, ":")
	return pool, name, ok && pool != "" && name != ""
}

// StreamLogs implements backend.Backend. It sends the runner log read so far,
// redacted, and returns.
func (b *Backend) StreamLogs(ctx context.Context, h backend.Handle, out chan<- backend.LogLine) error {
	pool, name, ok := splitRef(h.Ref)
	if !ok {
		return fmt.Errorf("bad runner reference %q", h.Ref)
	}
	res, err := b.run(ctx, "exec", pool, "cat", jobDir(name)+"/runner.log")
	if err != nil {
		return err
	}
	lines := strings.Split(strings.TrimRight(res.Stdout, "\n"), "\n")
	level := "info"
	if oom := b.reportOOM(ctx, pool); oom != "" {
		lines, level = append(lines, oom), "error"
	}
	for i, l := range lines {
		if l == "" {
			continue
		}
		lv := "info"
		if level == "error" && i == len(lines)-1 {
			lv = "error"
		}
		select {
		case out <- backend.LogLine{At: time.Now().UTC(), Level: lv, Message: b.redact(l), Step: "start"}:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

// ReportUsage implements backend.Backend. Usage per job is runners R5.12,
// which is not built; it gives only why the runner stopped when the memory cap
// killed it (R5.69).
func (b *Backend) ReportUsage(ctx context.Context, h backend.Handle) (backend.Usage, error) {
	return backend.Usage{StoppedBy: b.stoppedBy(ctx, h)}, nil
}

func (b *Backend) learn(values ...string) {
	if b.d.Secret == nil {
		return
	}
	for _, v := range values {
		if v != "" {
			b.d.Secret(v)
		}
	}
}

func (b *Backend) redact(s string) string {
	if b.d.Redact != nil {
		return b.d.Redact(s)
	}
	return s
}

func (b *Backend) log(step, msg string) {
	if b.d.LogLine != nil {
		b.d.LogLine(step, b.redact(msg))
	}
}

// busy says whether a job runs in the pool container: a Runner.Worker process.
// It fails closed: any answer other than a clear yes or no is an error.
func (b *Backend) busy(ctx context.Context, pool string) (bool, error) {
	exists, running, _, err := b.poolState(ctx, pool)
	if err != nil {
		return true, err
	}
	if !exists || !running {
		return false, nil
	}
	res, err := b.run(ctx, "exec", pool, "pgrep", "-f", "Runner.Worker")
	if err != nil {
		return true, err
	}
	switch res.ExitCode {
	case 0:
		return true, nil
	case 1:
		return false, nil
	}
	return true, fmt.Errorf("cannot read the jobs of %s: exit %s", pool, strconv.Itoa(res.ExitCode))
}

// limitsFor gives the caps of a repository's pool container: the pool size of
// the machine (CPUs, memory) when the spec carries it, else the backend's own
// Limits (runners R5.27).
func (b *Backend) limitsFor(r backend.RunnerSpec) Limits {
	l := b.cfg.Limits
	if r.PoolMemoryMB > 0 {
		l.MemoryMB = r.PoolMemoryMB
	}
	if r.PoolCPUs > 0 {
		l.CPUs = r.PoolCPUs
	}
	return l
}

// DefaultConfig is the production layout of the Linux container backend: the
// base image comes from the image files embedded in the binary, written to a
// build folder and built on the machine on first use (runners R5.33). Limits
// stay at zero (no cap) until the spec of a runner brings the pool size of its
// machine; `Limits` is the fallback for a spec without one.
func DefaultConfig() Config {
	root, err := os.UserCacheDir()
	if err != nil || root == "" {
		root = os.TempDir()
	}
	cfg := Config{
		Assets:    images.FS,
		BuildRoot: filepath.Join(root, "crsp", "image-build"),
		BaseName:  "linux-base",
		Pins:      defaultPins(),
		Limits:    Limits{},
		CacheRoot: filepath.Join(root, "crsp", "cache"),
		KVMProbe:  ProbeKVM,
		OpenSecrets: func(ctx context.Context) (secrets.Store, error) {
			return secrets.Open(ctx, filepath.Join(root, "crsp"))
		},
	}
	// On Linux the agent is a linux binary and is the one the containers mount
	// (runners R5.48). Elsewhere the container engine cannot see the agent's
	// own file, so no mount is made until the image copy is the only one.
	if runtime.GOOS == "linux" {
		if exe, err := os.Executable(); err == nil {
			cfg.CrspHostPath = exe
		}
	}
	return cfg
}

// defaultPins puts the pinned Actions runner version of this machine's
// architecture in the image key, so a new pin builds the image aside
// (runners R5.33, R5.37, R5.49).
func defaultPins() map[string]string {
	arch := "x64"
	if runtime.GOARCH == "arm64" {
		arch = "arm64"
	}
	p, err := runners.PinFor("linux", arch)
	if err != nil {
		return nil
	}
	return map[string]string{"actions-runner": p.Version + ":" + p.SHA256}
}
