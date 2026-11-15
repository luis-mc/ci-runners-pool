package persistent

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

const refusal = "2026-11-15 10:00:01Z: Runner listener exit with terminated error: A session for this runner already exists.\n"

func guard(now *time.Time, logs *[]string, pids []int) *SessionGuard {
	t0 := time.Date(2026, 11, 15, 10, 0, 0, 0, time.UTC)
	return &SessionGuard{Runner: "crsp-a", Restart: t0, Now: func() time.Time { return *now },
		Log:  func(s string) { *logs = append(*logs, s) },
		List: func(context.Context) ([]int, error) { return pids, nil }}
}

func TestStaleSessionInsideWindowIsQuiet(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 30, 0, time.UTC)
	var logs []string
	g := guard(&now, &logs, nil)
	for i := 0; i < 5; i++ {
		st, err := g.Observe(refusal)
		if st != SessionExpired || err != nil {
			t.Fatalf("got %v %v", st, err)
		}
		now = now.Add(20 * time.Second)
	}
	if len(logs) != 1 || !strings.Contains(logs[0], "until 10:03:00Z") {
		t.Fatalf("logs = %q", logs)
	}
}

func TestStaleSessionStartsNoSecondListener(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 30, 0, time.UTC)
	var logs []string
	g := guard(&now, &logs, []int{42})
	started := false
	err := g.Start(context.Background(), func(context.Context) error { started = true; return nil })
	if !errors.Is(err, ErrListenerAlive) || started {
		t.Fatalf("err %v started %v", err, started)
	}
	g.List = func(context.Context) ([]int, error) { return nil, nil }
	if err := g.Start(context.Background(), func(context.Context) error { started = true; return nil }); err != nil || !started {
		t.Fatalf("err %v started %v", err, started)
	}
}

func TestStaleSessionPastWindowIsAFault(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 3, 1, 0, time.UTC)
	var logs []string
	g := guard(&now, &logs, nil)
	st, err := g.Observe(refusal)
	if st != SessionFault || !errors.Is(err, ErrSessionStale) {
		t.Fatalf("got %v %v", st, err)
	}
	if len(logs) != 0 {
		t.Fatalf("logs = %q", logs)
	}
}

func TestOtherOutputIsClear(t *testing.T) {
	now := time.Date(2026, 11, 15, 10, 0, 30, 0, time.UTC)
	var logs []string
	if st, err := guard(&now, &logs, nil).Observe("Runner reconnected.\n"); st != SessionClear || err != nil {
		t.Fatalf("got %v %v", st, err)
	}
}

func TestUnknownRestartIsNeverInWindow(t *testing.T) {
	if InSessionWindow(time.Time{}, time.Now(), time.Minute) {
		t.Fatal("zero restart in window")
	}
}
