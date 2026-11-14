// Package windows is the persistent runner backend for Windows: a service
// that runs as the runner's own local non-admin account (runners R5.13 to
// R5.20, R5.5, R5.37; decision 0003).
//
// The package holds no Windows-only import. Every system call goes through
// sys.Commands, sys.FS and sys.Fetcher, so tests on any OS inject fakes and
// assert the exact PowerShell calls; the real wiring sits behind build tags in
// internal/backend/registry (runners R5.24, R6.9).
//
// Port of dev-standards scripts/delivery_runner_pool.py and the Windows
// service parts of scripts/delivery_ci_setup.py, with the tests of
// test_dl310_windows_runner.py and test_dl315_runner_remove_token.py (see the
// tests in this package).
package windows

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/persistent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/runners"
	"github.com/luis-mc/ci-runners-shared-pool/packaging/hooks"
)

// Config sets where things live.
type Config struct {
	// Root holds one folder per runner, for example C:\ProgramData\crsp\runners.
	Root string
	// CrspBinary is the all-users binary the hooks call.
	CrspBinary string
	// NewPassword makes a random password. Replaceable for tests.
	NewPassword func() string
}

// DefaultConfig is the production layout.
func DefaultConfig() Config {
	return Config{
		Root:        `C:\ProgramData\crsp\runners`,
		CrspBinary:  `C:\Program Files\crsp\crsp.exe`,
		NewPassword: RandomPassword,
	}
}

// Backend is the Windows persistent backend.
type Backend struct {
	d   sys.Deps
	cfg Config
}

var (
	_ backend.Backend      = (*Backend)(nil)
	_ backend.Finder       = (*Backend)(nil)
	_ backend.Deregisterer = (*Backend)(nil)
)

// New builds the backend over its seams.
func New(d sys.Deps, cfg Config) *Backend {
	if cfg.NewPassword == nil {
		cfg.NewPassword = RandomPassword
	}
	if cfg.Root == "" {
		cfg.Root = DefaultConfig().Root
	}
	return &Backend{d: d, cfg: cfg}
}

// RandomPassword makes a 32-character random password. It is made inside the
// process that registers the service and is never kept (runners R5.15).
func RandomPassword() string {
	const set = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!#%+-=?@"
	b := make([]byte, 32)
	for i := range b {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(set))))
		if err != nil {
			panic("crypto/rand failed: " + err.Error())
		}
		b[i] = set[n.Int64()]
	}
	return string(b)
}

// Name implements backend.Backend.
func (b *Backend) Name() backend.Name { return backend.Persistent }

// Join joins Windows path parts.
func Join(parts ...string) string {
	return strings.Join(parts, `\`)
}

// Folder is the runner folder for a runner name.
func (b *Backend) Folder(name string) string { return Join(b.cfg.Root, name) }

// ps runs a script on powershell.exe. The script goes on stdin; values go in
// the environment; secrets go in SecretEnv. No argument is a quoted command
// line (runners R5.18).
func (b *Backend) ps(ctx context.Context, script string, env, secret map[string]string) (sys.Result, error) {
	return b.d.Cmd.Run(ctx, sys.Command{
		Name:      "powershell.exe",
		Args:      []string{"-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", "-"},
		Stdin:     script,
		Env:       env,
		SecretEnv: secret,
	})
}

func (b *Backend) psOK(ctx context.Context, step, script string, env, secret map[string]string) error {
	res, err := b.ps(ctx, script, env, secret)
	if err != nil {
		return fmt.Errorf("%s: %w", step, err)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("%s: powershell exited %d: %s", step, res.ExitCode, b.redact(firstLine(res.Stderr+res.Stdout)))
	}
	return nil
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

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return s
}

// Detect reports whether PowerShell is there and whether the agent has the
// admin rights account and service work needs (runners R5.9).
func (b *Backend) Detect(ctx context.Context) (backend.Support, error) {
	s := backend.Support{Name: backend.Persistent, Isolation: backend.IsolationPersistent, OS: []string{"windows"}}
	res, err := b.ps(ctx, scriptDetect, nil, nil)
	if err != nil || res.ExitCode != 0 {
		s.Reason = "powershell.exe cannot be run"
		return s, nil
	}
	s.Present = true
	out := strings.TrimSpace(res.Stdout)
	if !strings.Contains(out, "admin=True") {
		s.Reason = "the agent is not running with administrator rights"
		return s, nil
	}
	s.Usable = true
	return s, nil
}

// PrepareImage has no image for a persistent runner.
func (b *Backend) PrepareImage(context.Context, backend.ImageSpec) (backend.ImageRef, error) {
	return backend.ImageRef{}, nil
}

// wantMeta and wantEnv are what the runner should look like.
func (b *Backend) want(r backend.RunnerSpec, account string) (persistent.Meta, string) {
	folder := b.Folder(r.Name)
	hookDir := Join(folder, "hooks")
	env := persistent.Env(map[string]string{
		"ACTIONS_RUNNER_HOOK_JOB_STARTED":   Join(hookDir, "job-started.ps1"),
		"ACTIONS_RUNNER_HOOK_JOB_COMPLETED": Join(hookDir, "job-completed.ps1"),
		"PSExecutionPolicyPreference":       "RemoteSigned",
	})
	return persistent.Meta{
		Name: r.Name, Account: account, Folder: folder,
		Service:   persistent.ServiceName(r.GitHubURL, r.Name),
		GitHubURL: r.GitHubURL, Labels: r.Labels, SymlinkRight: r.WindowsSymlinkRight,
		RunnerVersion: r.RunnerVersion,
	}, env
}

// ErrRemovalFailed means the old registration could not be removed. The old
// runner and its folder are left as they were (runners R5.19).
var ErrRemovalFailed = errors.New("removing the old runner registration failed; the old runner is left as it was")

// Start registers and starts a persistent runner. Steps, in order:
//
//  1. decide from what is on the machine (already, rewrite .env, change the
//     right, register again, or fresh);
//  2. when registering again in place: remove the old registration with a
//     remove token and check the result, before anything is locked;
//  3. fetch the pinned archive, check its SHA-256, unpack;
//  4. register the runner with GitHub, its self-update off;
//  5. make the account (random password, never kept) and its rights;
//  6. write the .ps1 hooks and the .env;
//  7. lock the folder to the account, Administrators and SYSTEM;
//  8. register the service as the account and start it.
func (b *Backend) Start(ctx context.Context, r backend.RunnerSpec, cfg backend.StartConfig) (backend.Handle, error) {
	if cfg.Registration == "" {
		return backend.Handle{}, errors.New("a persistent runner needs a registration token")
	}
	if !runners.ValidSHA256(r.RunnerSHA256) {
		return backend.Handle{}, runners.ErrBadHash
	}
	folder := b.Folder(r.Name)
	account := runners.AccountName(r.Name, nil)
	wantMeta, wantEnv := b.want(r, account)
	h := backend.Handle{RunnerID: r.ID, Ref: wantMeta.Service}

	have, err := persistent.ReadMeta(b.d.FS, Join(folder, persistent.MetaFile))
	if err != nil {
		return h, fmt.Errorf("read runner folder: %w", err)
	}
	var haveEnv string
	if e, err := b.d.FS.ReadFile(Join(folder, ".env")); err == nil {
		haveEnv = string(e)
	}
	action := persistent.Decide(have, haveEnv, wantMeta, wantEnv)
	b.log("register", fmt.Sprintf("runner %s: %s", r.Name, action))

	env := map[string]string{"CRSP_FOLDER": folder, "CRSP_ACCOUNT": account, "CRSP_SERVICE": wantMeta.Service, "CRSP_RUNNER": r.Name}
	switch action {
	case persistent.Already:
		return h, nil
	case persistent.RewriteEnv:
		if err := b.writeHooksAndEnv(folder, wantEnv); err != nil {
			return h, err
		}
		if err := persistent.WriteMeta(b.d.FS, Join(folder, persistent.MetaFile), wantMeta); err != nil {
			return h, err
		}
		return h, b.psOK(ctx, "restart", scriptRestart, env, nil)
	case persistent.UpdateRights:
		env["CRSP_SYMLINK"] = flag(r.WindowsSymlinkRight)
		if err := b.psOK(ctx, "rights", scriptRights, env, nil); err != nil {
			return h, err
		}
		return h, persistent.WriteMeta(b.d.FS, Join(folder, persistent.MetaFile), wantMeta)
	case persistent.Reregister:
		if cfg.Removal == "" {
			return h, errors.New("registering again in place needs a remove token for the old runner")
		}
		oldService := have.Service
		oldEnv := map[string]string{"CRSP_FOLDER": have.Folder, "CRSP_SERVICE": oldService}
		if err := b.psOK(ctx, "stop old service", scriptStopService, oldEnv, nil); err != nil {
			return h, err
		}
		// The old registration goes first, and its result is checked, before
		// the folder is locked to the new account (R5.19, DL315).
		if err := b.runner(ctx, "remove old registration", have.Folder, []string{"remove"}, cfg.Removal); err != nil {
			// Leave the old runner as it was: start its service again.
			_ = b.psOK(ctx, "restart old service", scriptStartService, oldEnv, nil)
			return h, fmt.Errorf("%w: %v", ErrRemovalFailed, err)
		}
		if err := b.psOK(ctx, "delete old service", scriptDeleteService, oldEnv, nil); err != nil {
			return h, err
		}
	case persistent.Fresh:
		archive := Join(b.cfg.Root, "_download-"+r.Name+".zip")
		if err := b.d.FS.MkdirAll(b.cfg.Root, 0o755); err != nil {
			return h, err
		}
		pin := runners.Pin{OS: "windows", Arch: r.Arch, Version: r.RunnerVersion, SHA256: r.RunnerSHA256}
		if err := persistent.Download(ctx, b.d, pin.DownloadURL(), archive, r.RunnerSHA256); err != nil {
			return h, err
		}
		env["CRSP_ARCHIVE"] = archive
		if err := b.psOK(ctx, "unpack", scriptExtract, env, nil); err != nil {
			return h, err
		}
	}

	// Register with GitHub. The runner's own update is off (R5.38). The token
	// goes in the environment of this one process.
	if err := b.runner(ctx, "register", folder,
		persistent.ConfigArgs(r.GitHubURL, r.Name, r.Group, r.Labels), cfg.Registration); err != nil {
		return h, err
	}

	// The password is made here, set on the account and passed only to the
	// service registration (R5.15).
	password := b.cfg.NewPassword()
	secret := map[string]string{"CRSP_PASSWORD": password}
	env["CRSP_GROUP"] = runners.RunnersGroup
	env["CRSP_SYMLINK"] = flag(r.WindowsSymlinkRight)
	if err := b.psOK(ctx, "account", scriptAccount, env, secret); err != nil {
		return h, err
	}
	if err := b.writeHooksAndEnv(folder, wantEnv); err != nil {
		return h, err
	}
	if err := persistent.WriteMeta(b.d.FS, Join(folder, persistent.MetaFile), wantMeta); err != nil {
		return h, err
	}
	if err := b.psOK(ctx, "lock folder", scriptLock, env, nil); err != nil {
		return h, err
	}
	if err := b.psOK(ctx, "register service", scriptRegisterService, env, secret); err != nil {
		return h, err
	}
	b.log("start", "service "+wantMeta.Service+" started as "+account)
	return h, nil
}

func flag(v bool) string {
	if v {
		return "1"
	}
	return "0"
}

// runner runs Runner.Listener (configure or remove). The arguments are one
// JSON array, each argument on its own. The exit code is checked.
func (b *Backend) runner(ctx context.Context, step, folder string, args []string, token string) error {
	raw, err := json.Marshal(args)
	if err != nil {
		return err
	}
	res, err := b.ps(ctx, scriptRunner,
		map[string]string{"CRSP_FOLDER": folder, "CRSP_ARGS": string(raw)},
		map[string]string{"ACTIONS_RUNNER_INPUT_TOKEN": token})
	if err != nil {
		return fmt.Errorf("%s: %w", step, err)
	}
	if res.ExitCode != 0 {
		return fmt.Errorf("%s: runner exited %d: %s", step, res.ExitCode, b.redact(firstLine(res.Stderr+res.Stdout)))
	}
	return nil
}

func (b *Backend) writeHooksAndEnv(folder, env string) error {
	hookDir := Join(folder, "hooks")
	if err := b.d.FS.MkdirAll(hookDir, 0o755); err != nil {
		return err
	}
	for _, n := range []string{"job-started", "job-completed"} {
		body, err := hooks.Windows(n)
		if err != nil {
			return err
		}
		if err := b.d.FS.WriteFile(Join(hookDir, n+".ps1"), body, 0o644); err != nil {
			return err
		}
	}
	return b.d.FS.WriteFile(Join(folder, ".env"), []byte(env), 0o644)
}

// Stop stops the service. Callers drain first and check for an idle runner
// right before (runners R6.4).
func (b *Backend) Stop(ctx context.Context, h backend.Handle) error {
	return b.psOK(ctx, "stop", scriptStopService, map[string]string{"CRSP_SERVICE": h.Ref}, nil)
}

// Deregister removes the runner from GitHub with a remove token and checks the
// result. On failure nothing else is touched (runners R5.19, R5.4).
func (b *Backend) Deregister(ctx context.Context, h backend.Handle, removeToken string) error {
	f, ok, err := b.lookup(ctx, h.Ref)
	if err != nil {
		return err
	}
	if !ok {
		return nil // already gone
	}
	if err := b.psOK(ctx, "stop", scriptStopService, map[string]string{"CRSP_SERVICE": h.Ref}, nil); err != nil {
		return err
	}
	if err := b.runner(ctx, "deregister", f.Folder, []string{"remove"}, removeToken); err != nil {
		_ = b.psOK(ctx, "start", scriptStartService, map[string]string{"CRSP_SERVICE": h.Ref}, nil)
		return fmt.Errorf("%w: %v", ErrRemovalFailed, err)
	}
	return nil
}

// CleanUp removes the service, the account and the folder. It is safe to call
// twice (runners R5.10). Deregister runs first.
func (b *Backend) CleanUp(ctx context.Context, h backend.Handle) error {
	f, ok, err := b.lookup(ctx, h.Ref)
	if err != nil {
		return err
	}
	env := map[string]string{"CRSP_SERVICE": h.Ref}
	var errs []error
	if err := b.psOK(ctx, "delete service", scriptDeleteService, env, nil); err != nil {
		errs = append(errs, err)
	}
	if ok {
		account := strings.TrimPrefix(f.Account, `.\`)
		if strings.HasPrefix(account, runners.AccountPrefix) {
			if err := b.psOK(ctx, "remove account", scriptRemoveAccount, map[string]string{"CRSP_ACCOUNT": account}, nil); err != nil {
				errs = append(errs, err)
			}
		}
		if f.Folder != "" && strings.HasPrefix(strings.ToLower(f.Folder), strings.ToLower(b.cfg.Root)+`\`) {
			if err := b.d.FS.RemoveAll(f.Folder); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errors.Join(errs...)
}

// StreamLogs sends the newest runner log lines, redacted.
func (b *Backend) StreamLogs(ctx context.Context, h backend.Handle, out chan<- backend.LogLine) error {
	f, ok, err := b.lookup(ctx, h.Ref)
	if err != nil || !ok {
		return err
	}
	res, err := b.ps(ctx, scriptTail, map[string]string{"CRSP_FOLDER": f.Folder}, nil)
	if err != nil {
		return err
	}
	for _, line := range strings.Split(strings.TrimSpace(res.Stdout), "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		select {
		case out <- backend.LogLine{At: time.Now(), Level: "info", Message: b.redact(strings.TrimSpace(line)), Step: "runner"}:
		case <-ctx.Done():
			return ctx.Err()
		}
	}
	return nil
}

// ReportUsage reads the service process' CPU time and peak memory.
func (b *Backend) ReportUsage(ctx context.Context, h backend.Handle) (backend.Usage, error) {
	res, err := b.ps(ctx, scriptUsage, map[string]string{"CRSP_SERVICE": h.Ref}, nil)
	if err != nil {
		return backend.Usage{}, err
	}
	var cpu, mem int64
	for _, kv := range strings.Split(strings.TrimSpace(res.Stdout), ";") {
		k, v, _ := strings.Cut(kv, "=")
		var n int64
		_, _ = fmt.Sscan(v, &n)
		switch k {
		case "cpu_ms":
			cpu = n
		case "mem":
			mem = n
		}
	}
	return backend.Usage{CPU: time.Duration(cpu) * time.Millisecond, MemoryPeak: mem}, nil
}
