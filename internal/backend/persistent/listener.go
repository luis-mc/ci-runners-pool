package persistent

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

// The runner listener (Runner.Listener) is the process that holds the
// runner's one session with GitHub. A second listener for a registered runner
// is refused ("a session for this runner already exists") and the first one
// keeps the session. crsp therefore supervises the listener, not the service
// wrapper around it (systemd unit, launchd daemon, Windows service, runsvc):
// it never starts a service while a listener of that runner folder is alive,
// and after a stop it waits for the listener itself to be gone (runners R5.46).

// ErrListenerAlive means a listener of the runner is still running, so no
// second one is started.
var ErrListenerAlive = errors.New("a listener of this runner is still running")

// Defaults for WaitNoListener.
const (
	ListenerWait = 30 * time.Second
	ListenerPoll = time.Second
)

// ListenerCommand lists the process ids of the listeners that run from folder
// on Linux and macOS (pgrep prints one id per line; exit 1 means none).
func ListenerCommand(folder string) sys.Command {
	return sys.Command{Name: "pgrep", Args: []string{"-f", "--", "^" + regexp.QuoteMeta(strings.TrimRight(folder, "/")) + "/bin/Runner\\.Listener"}}
}

// ParsePIDs reads one process id per line and ignores everything else.
func ParsePIDs(out string) []int {
	var pids []int
	for _, l := range strings.Fields(out) {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			pids = append(pids, n)
		}
	}
	return pids
}

// UnixListeners returns the listener process ids of a runner folder.
func UnixListeners(ctx context.Context, cmd sys.Commands, folder string) ([]int, error) {
	res, err := cmd.Run(ctx, ListenerCommand(folder))
	if err != nil {
		return nil, fmt.Errorf("list listeners: %w", err)
	}
	if res.ExitCode > 1 { // 1 is "no match"
		return nil, fmt.Errorf("list listeners: pgrep exited %d", res.ExitCode)
	}
	return ParsePIDs(res.Stdout), nil
}

// WaitNoListener polls list until no listener of the runner is alive. When the
// wait runs out it returns ErrListenerAlive with the ids, and the caller must
// not start the service. A list that cannot be read is an error too: crsp does
// not start a second listener on a guess. sleep may be nil.
func WaitNoListener(ctx context.Context, list func(context.Context) ([]int, error), wait, poll time.Duration, sleep func(context.Context, time.Duration)) error {
	if wait <= 0 {
		wait = ListenerWait
	}
	if poll <= 0 {
		poll = ListenerPoll
	}
	if sleep == nil {
		sleep = func(ctx context.Context, d time.Duration) {
			t := time.NewTimer(d)
			defer t.Stop()
			select {
			case <-t.C:
			case <-ctx.Done():
			}
		}
	}
	var waited time.Duration
	for {
		pids, err := list(ctx)
		if err != nil {
			return err
		}
		if len(pids) == 0 {
			return nil
		}
		if waited >= wait || ctx.Err() != nil {
			return fmt.Errorf("%w (process %v); no second listener is started", ErrListenerAlive, pids)
		}
		sleep(ctx, poll)
		waited += poll
	}
}
