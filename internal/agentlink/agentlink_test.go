package agentlink

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

type sendFn func(string, *agentv1.SessionResponse) error

func (f sendFn) Send(id string, m *agentv1.SessionResponse) error { return f(id, m) }

// The message holds the JIT config and the registration; an error from the
// send never repeats it.
func TestOfflineErrorHoldsNoConfig(t *testing.T) {
	jit := "JITCONFIG" + "-value-0123456789"
	l := New(sendFn(func(string, *agentv1.SessionResponse) error { return errors.New("offline") }))
	_, err := (&Agent{L: l}).AddRunner(context.Background(), "m", backend.RunnerSpec{Name: "n"}, backend.StartConfig{JITConfig: jit})
	if err == nil || strings.Contains(err.Error(), jit) {
		t.Fatalf("err = %v", err)
	}
}

func TestNoAnswerTimesOut(t *testing.T) {
	l := New(sendFn(func(string, *agentv1.SessionResponse) error { return nil }))
	l.Timeout = 20 * time.Millisecond
	err := (&Agent{L: l}).StopService(context.Background(), "m", "s")
	if !errors.Is(err, ErrNoAnswer) {
		t.Fatalf("err = %v", err)
	}
	if len(l.pending) != 0 {
		t.Fatal("a command stayed pending")
	}
}

func TestContextEndsTheWait(t *testing.T) {
	l := New(sendFn(func(string, *agentv1.SessionResponse) error { return nil }))
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if err := (&Agent{L: l}).CleanUp(ctx, "m", "s"); !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
}

// A result with ok false is an error, even when outcome says nothing.
func TestResultWithoutOkIsAFailure(t *testing.T) {
	var l *Link
	l = New(sendFn(func(_ string, m *agentv1.SessionResponse) error {
		id := m.GetStopRunner().GetCommandId()
		go l.OnMessage("m", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_RunnerResult{RunnerResult: &agentv1.RunnerResult{CommandId: id}}})
		return nil
	}))
	if err := (&Agent{L: l}).StopService(context.Background(), "m", "s"); err == nil {
		t.Fatal("a result without ok was taken as done")
	}
}
