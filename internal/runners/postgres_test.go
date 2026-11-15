package runners

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/container"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/secrets"
)

// fakeEngine builds `docker <args>` calls and never runs one.
type fakeEngine struct{}

func (fakeEngine) Detect(context.Context) (container.Status, error) {
	return container.Status{Present: true, Usable: true}, nil
}
func (fakeEngine) Command(args ...string) (sys.Command, error) {
	return sys.Command{Name: "docker", Args: args}, nil
}
func (e fakeEngine) Run(context.Context, ...string) (sys.Result, error) { return sys.Result{}, nil }

// fakePG answers docker calls and records them. SQL on stdin is kept.
type fakePG struct {
	mu        sync.Mutex
	calls     []sys.Command
	hasCtr    bool
	running   string
	dbExists  bool
	failSQLOn string
}

func (f *fakePG) Run(_ context.Context, c sys.Command) (sys.Result, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, c)
	a := strings.Join(c.Args, " ")
	switch {
	case strings.HasPrefix(a, "network inspect"):
		return sys.Result{ExitCode: 1}, nil
	case strings.HasPrefix(a, "inspect"):
		if !f.hasCtr {
			return sys.Result{ExitCode: 1}, nil
		}
		return sys.Result{Stdout: f.running + "\n"}, nil
	case strings.HasPrefix(a, "run "):
		f.hasCtr, f.running = true, "true"
	case strings.Contains(a, "psql"):
		if f.failSQLOn != "" && strings.Contains(c.Stdin, f.failSQLOn) {
			return sys.Result{ExitCode: 3, Stderr: "ERROR: boom " + c.SecretEnv["PGPASSWORD"] + "\n"}, nil
		}
		if strings.Contains(c.Stdin, "FROM pg_database") && f.dbExists {
			return sys.Result{Stdout: "1\n"}, nil
		}
		if strings.Contains(c.Stdin, "CREATE DATABASE") {
			f.dbExists = true
		}
	}
	return sys.Result{}, nil
}

func (f *fakePG) sql() string {
	var b strings.Builder
	for _, c := range f.calls {
		b.WriteString(c.Stdin)
	}
	return b.String()
}

func newPG(t *testing.T) (*Postgres, *fakePG, *secrets.Memory) {
	t.Helper()
	f, sec := &fakePG{}, secrets.NewMemory()
	return &Postgres{Engine: fakeEngine{}, Cmd: f, Secrets: sec, Owners: &MemoryRoleOwners{}, Pool: "p1", Retries: 2}, f, sec
}

func TestRolePerRunnerIsolatedAndRemoved(t *testing.T) {
	ctx := context.Background()
	p, f, sec := newPG(t)
	if err := p.EnsureServer(ctx); err != nil {
		t.Fatal(err)
	}
	var run string
	for _, c := range f.calls {
		if len(c.Args) > 0 && c.Args[0] == "run" {
			run = strings.Join(c.Args, " ")
			if c.SecretEnv["POSTGRES_PASSWORD"] == "" {
				t.Error("admin password not passed as a secret value")
			}
		}
	}
	if !strings.Contains(run, PostgresImage) || strings.Contains(run, " -p ") || strings.Contains(run, "--publish") {
		t.Errorf("server must be postgres 16 with no published port: %s", run)
	}
	a, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "Runner-1"})
	if err != nil {
		t.Fatal(err)
	}
	b, err := p.Provision(ctx, DBSpec{Repo: "o/b", RunnerID: "runner-2"})
	if err != nil {
		t.Fatal(err)
	}
	if a.User == b.User || a.Database == b.Database || a.Password == b.Password || len(a.Password) < 32 {
		t.Errorf("logins must differ with random passwords: %+v %+v", a, b)
	}
	if a.User != "r_runner_1" || a.Database != a.User {
		t.Errorf("name %q", a.User)
	}
	sql := f.sql()
	if !strings.Contains(sql, "REVOKE ALL ON DATABASE r_runner_1 FROM PUBLIC") || !strings.Contains(sql, "CREATE DATABASE r_runner_1 OWNER r_runner_1") {
		t.Errorf("database not owned and closed to others: %s", sql)
	}
	if stored, _ := sec.Get(ctx, p.loginKey(a.User)); string(stored) != a.Password {
		t.Error("password not kept in the secret store")
	}
	if err := p.Remove(ctx, "Runner-1"); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(f.sql(), "DROP DATABASE IF EXISTS r_runner_1") || !strings.Contains(f.sql(), "DROP ROLE IF EXISTS r_runner_1") {
		t.Error("login and database not dropped")
	}
	if _, err := sec.Get(ctx, p.loginKey(a.User)); !errors.Is(err, secrets.ErrNotFound) {
		t.Error("password left in the secret store")
	}
	if _, err := sec.Get(ctx, p.loginKey(b.User)); err != nil {
		t.Error("other runner's password touched")
	}
}

func TestCreatedbOptInAndDeclaredRoles(t *testing.T) {
	ctx := context.Background()
	p, f, _ := newPG(t)
	if _, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1"}); err != nil {
		t.Fatal(err)
	}
	if s := f.sql(); !strings.Contains(s, "NOCREATEDB") || strings.Contains(strings.ReplaceAll(s, "NOCREATEDB", ""), "CREATEDB") {
		t.Errorf("CREATEDB must be off by default: %s", s)
	}
	f.calls = nil
	if _, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1", CreateDB: true, Roles: []string{"app_ro", "app_rw"}}); err != nil {
		t.Fatal(err)
	}
	s := f.sql()
	for _, want := range []string{"PASSWORD", " CREATEDB;", "CREATE ROLE app_ro NOLOGIN", "CREATE ROLE app_rw NOLOGIN", "GRANT app_ro TO r_r1 WITH ADMIN OPTION", "IF NOT EXISTS"} {
		if !strings.Contains(s, want) {
			t.Errorf("missing %q in %s", want, s)
		}
	}
	for _, bad := range []string{"postgres", "public", "pg_monitor", "Upper", "1abc", "a-b", "", strings.Repeat("a", 64)} {
		if _, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1", Roles: []string{bad}}); !errors.Is(err, ErrRoleName) {
			t.Errorf("role %q accepted: %v", bad, err)
		}
	}
	if _, err := p.Provision(ctx, DBSpec{Repo: "o/b", RunnerID: "r2", Roles: []string{"app_ro"}}); !errors.Is(err, ErrRoleOwned) ||
		!strings.Contains(err.Error(), "o/a") || !strings.Contains(err.Error(), "o/b") {
		t.Errorf("foreign role must name both repositories: %v", err)
	}
	if _, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r3", Roles: []string{"app_ro"}}); err != nil {
		t.Errorf("same repository may reuse its role: %v", err)
	}
}

func TestRerunKeepsPassword(t *testing.T) {
	ctx := context.Background()
	p, f, _ := newPG(t)
	first, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	f.calls = nil
	second, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	if first.Password != second.Password {
		t.Error("rerun changed the password")
	}
	if strings.Contains(f.sql(), "CREATE DATABASE") {
		t.Error("rerun created the database again")
	}
	// A restart of an existing, stopped server starts it and does not recreate it.
	f.hasCtr, f.running = true, "false"
	f.calls = nil
	if err := p.EnsureServer(ctx); err != nil {
		t.Fatal(err)
	}
	for _, c := range f.calls {
		if len(c.Args) > 0 && c.Args[0] == "run" {
			t.Error("existing server container recreated")
		}
	}
}

func TestDbEnvMasksSecrets(t *testing.T) {
	ctx := context.Background()
	p, f, _ := newPG(t)
	f.failSQLOn = "CREATE ROLE"
	_, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1"})
	if err == nil {
		t.Fatal("want a failure")
	}
	admin, _ := p.Secrets.Get(ctx, p.adminKey())
	login, _ := p.Secrets.Get(ctx, p.loginKey("r_r1"))
	if strings.Contains(err.Error(), string(admin)) || strings.Contains(err.Error(), string(login)) {
		t.Errorf("a password reached the error: %v", err)
	}
	for _, c := range f.calls {
		for _, a := range c.Args {
			if strings.Contains(a, string(admin)) || strings.Contains(a, string(login)) {
				t.Errorf("a password is in an argument: %v", c.Args)
			}
		}
		if c.Stdin != "" && strings.Contains(c.Stdin, string(admin)) {
			t.Error("admin password in SQL")
		}
	}
	f.failSQLOn = ""
	acc, err := p.Provision(ctx, DBSpec{Repo: "o/a", RunnerID: "r1"})
	if err != nil {
		t.Fatal(err)
	}
	file := acc.DBEnvFile()
	for _, k := range []string{"DATABASE" + "_URL=postgres://r_r1:", "PGHOST=crsp-pg-p1", "PGPORT=5432", "PGUSER=r_r1", "PGPASSWORD=" + acc.Password, "PGDATABASE=r_r1"} {
		if !strings.Contains(file, k) {
			t.Errorf("db.env lacks %q", k)
		}
	}
}
