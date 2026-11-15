package jobcmd

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strings"
)

// EnvFileVar names the pool's db.env file. The agent sets it in the job's
// environment only for a runner that has a database; its value is a path, not
// a secret.
const EnvFileVar = "CRSP_DB_ENV_FILE"

// Env is what a job command reads and writes.
type Env struct {
	Getenv func(string) string
	Stdout io.Writer
	Stderr io.Writer
}

// secretKeys are the db.env keys whose values are masked in the job log.
var secretKeys = map[string]bool{"PGPASSWORD": true, "DATABASE_URL": true}

// DBEnv is `crsp db-env` (runners R5.54, port of pool-db-env). It reads the
// runner's db.env, prints a `::add-mask::` line for each secret value so the
// Actions log hides it, and appends the lines to the file GITHUB_ENV names.
// Outside a pool job (no db.env) it says it does nothing and exits 0. A
// value is never printed except as a mask command.
func DBEnv(env Env) int {
	path := env.Getenv(EnvFileVar)
	if path == "" {
		_, _ = fmt.Fprintln(env.Stdout, "crsp db-env: not a pool job with a database, nothing to do")
		return 0
	}
	target := env.Getenv("GITHUB_ENV")
	if target == "" {
		_, _ = fmt.Fprintln(env.Stderr, "crsp db-env: GITHUB_ENV is not set, so the settings cannot reach the next steps")
		return 1
	}
	f, err := os.Open(path)
	if err != nil {
		_, _ = fmt.Fprintf(env.Stderr, "crsp db-env: cannot read the database settings file: %v\n", err)
		return 1
	}
	defer func() { _ = f.Close() }()
	var lines []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		line := strings.TrimRight(sc.Text(), "\r")
		k, v, ok := strings.Cut(line, "=")
		if !ok || k == "" || strings.ContainsAny(v, "\r\n") {
			continue
		}
		if secretKeys[k] && v != "" {
			// Mask first, so no later line can show the value.
			_, _ = fmt.Fprintf(env.Stdout, "::add-mask::%s\n", v)
		}
		lines = append(lines, k+"="+v)
	}
	if err := sc.Err(); err != nil || len(lines) == 0 {
		_, _ = fmt.Fprintln(env.Stderr, "crsp db-env: the database settings file is empty or unreadable")
		return 1
	}
	out, err := os.OpenFile(target, os.O_APPEND|os.O_WRONLY|os.O_CREATE, 0o600)
	if err != nil {
		_, _ = fmt.Fprintf(env.Stderr, "crsp db-env: cannot write GITHUB_ENV: %v\n", err)
		return 1
	}
	defer func() { _ = out.Close() }()
	if _, err := out.WriteString(strings.Join(lines, "\n") + "\n"); err != nil {
		_, _ = fmt.Fprintf(env.Stderr, "crsp db-env: cannot write GITHUB_ENV: %v\n", err)
		return 1
	}
	_, _ = fmt.Fprintf(env.Stdout, "crsp db-env: %d database settings added for the next steps\n", len(lines))
	return 0
}
