package agent_test

import (
	"context"
	"testing"
	"time"

	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

func TestSmokeJoinAndSession(t *testing.T) {
	c := startController(t)
	code, err := c.Svc.CreateJoinCode(context.Background(), "owner", 0)
	if err != nil {
		t.Fatal(err)
	}
	cfg := fastConfig(t, c, code.Code)
	stop := runAgent(t, cfg)
	waitFor(t, "machine online", func() bool {
		vs, _ := c.Svc.List(context.Background())
		return len(vs) == 1 && vs[0].Machine.Online && vs[0].Load != nil
	})
	vs, _ := c.Svc.List(context.Background())
	if vs[0].Machine.Name != "box-1" || vs[0].Machine.Facts.CPUModel == "" {
		t.Fatalf("machine = %+v", vs[0].Machine)
	}
	if err := stop(); err != nil {
		t.Fatal(err)
	}
	_ = machines.StateActive
	_ = time.Second
}
