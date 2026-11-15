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
