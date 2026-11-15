package api

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/api/gen"
	"github.com/luis-mc/ci-runners-shared-pool/internal/auth"
	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
	"github.com/luis-mc/ci-runners-shared-pool/internal/machines"
)

func poolMux(t *testing.T) (*http.ServeMux, string) {
	t.Helper()
	svc := machines.New(machines.Options{Repo: machines.NewMemRepo(), ControllerAddress: "pool.lan", AgentPort: 8461, Fingerprint: strings.Repeat("ab", 32)})
	code, err := svc.CreateJoinCode(context.Background(), "owner", 0)
	if err != nil {
		t.Fatal(err)
	}
	res, err := svc.Join(context.Background(), machines.JoinInput{Code: code.Code, Facts: machines.Facts{HostName: "box-1", OS: "linux", Arch: "x64", Threads: 8, MemoryBytes: 32 << 30}})
	if err != nil {
		t.Fatal(err)
	}
	if err := svc.HandleLoad(context.Background(), res.MachineID, &agentv1.LoadReport{MemoryPct: 25, MemoryKnown: true}); err != nil {
		t.Fatal(err)
	}
	mux := http.NewServeMux()
	Register(mux, Options{Version: "test", DB: fakeDB{}, Logger: slog.New(slog.NewTextHandler(io.Discard, nil)), Machines: svc, CA: fakeCA{}, Authn: asRole(auth.RoleOwner)})
	return mux, res.MachineID
}

// machines R5.58 over the API: saved when it fits, 400 with the reason when it
// does not, 409 needs_confirmation for a shrink until confirm_shrink is sent.
func TestPoolSizeThroughTheAPI(t *testing.T) {
	mux, id := poolMux(t)
	rec := doM(t, mux, "PATCH", "/api/v1/machines/"+id, map[string]any{"pool_memory_gib": 16.5, "pool_cpus": 4})
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	var m gen.Machine
	_ = json.Unmarshal(rec.Body.Bytes(), &m)
	if m.Settings.PoolMemoryGib == nil || *m.Settings.PoolMemoryGib != 16.5 || *m.Settings.PoolCpus != 4 {
		t.Fatalf("settings = %+v", m.Settings)
	}
	rec = doM(t, mux, "PATCH", "/api/v1/machines/"+id, map[string]any{"pool_memory_gib": 30, "pool_cpus": 4})
	if rec.Code != 400 || !strings.Contains(rec.Body.String(), "memory budget") {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
	rec = doM(t, mux, "PATCH", "/api/v1/machines/"+id, map[string]any{"pool_memory_gib": 8, "pool_cpus": 4, "confirm": true})
	if rec.Code != 409 {
		t.Fatalf("a shrink needs its own yes: %d %s", rec.Code, rec.Body)
	}
	assertEnvelope(t, rec, CodeNeedsConfirmation)
	rec = doM(t, mux, "PATCH", "/api/v1/machines/"+id, map[string]any{"pool_memory_gib": 8, "pool_cpus": 4, "confirm_shrink": true})
	if rec.Code != 200 {
		t.Fatalf("%d %s", rec.Code, rec.Body)
	}
}

// machines R5.58: the dry run behind the console's Review step answers the
// result and the nearest sizes and saves nothing.
func TestPoolSizeCheckDryRun(t *testing.T) {
	mux, id := poolMux(t)
	check := func(mem float64, cpus int) gen.PoolSizeCheck {
		t.Helper()
		rec := doM(t, mux, "POST", "/api/v1/machines/"+id+"/pool-size-check", map[string]any{"pool_memory_gib": mem, "pool_cpus": cpus})
		if rec.Code != 200 {
			t.Fatalf("%d %s", rec.Code, rec.Body)
		}
		var c gen.PoolSizeCheck
		_ = json.Unmarshal(rec.Body.Bytes(), &c)
		return c
	}
	if c := check(16.5, 4); !c.Known || !c.Ok || c.NeedsShrinkConfirm {
		t.Fatalf("a size that fits: %+v", c)
	}
	c := check(30, 4)
	if !c.Known || c.Ok || c.Reason == nil || len(c.Nearest) == 0 || c.Short == nil || *c.Short != "memory" || c.RoomGib == nil {
		t.Fatalf("a size over the budget names the budget and the nearest size: %+v", c)
	}
	if rec := doM(t, mux, "GET", "/api/v1/machines/"+id, nil); strings.Contains(rec.Body.String(), `"pool_cpus":4`) {
		t.Fatalf("the check saved a size: %s", rec.Body)
	}
	if rec := doM(t, mux, "PATCH", "/api/v1/machines/"+id, map[string]any{"pool_memory_gib": 16.5, "pool_cpus": 4}); rec.Code != 200 {
		t.Fatal(rec.Body)
	}
	if c := check(8, 4); !c.Ok || !c.NeedsShrinkConfirm || c.CurrentCpus != 4 || c.CurrentMemoryGib != 16.5 {
		t.Fatalf("a lower size says it needs the explicit yes: %+v", c)
	}
	if c := check(0, 0); !c.Known || !c.Ok || !c.NeedsShrinkConfirm {
		t.Fatalf("clearing is a shrink: %+v", c)
	}
	if rec := doM(t, mux, "POST", "/api/v1/machines/"+id+"/pool-size-check", map[string]any{"pool_memory_gib": 8, "pool_cpus": 0}); rec.Code != 400 {
		t.Fatalf("memory without CPUs is refused: %d", rec.Code)
	}
}
