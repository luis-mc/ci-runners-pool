package poolsize

import (
	"strings"
	"testing"
)

func box() Inputs {
	// 32 GiB, 16 CPUs, 6 GiB used outside WSL: memory room 27.2-6 = 21.2 GiB, CPU budget 9.
	return Inputs{TotalBytes: 32 * GiB, TotalCPUs: 16, UsedOutsideBytes: 6 * GiB, BudgetMemPct: 85, BudgetCPUPct: 60}
}

// R5.54
func TestParseWSLConfigReadsOnlyWSL2(t *testing.T) {
	c := ParseWSLConfig("\xef\xbb\xbf[experimental]\nmemory=1GB\n[wsl2]\n# comment\nMemory = 12GB ; note\nprocessors=8\nnestedVirtualization=true\n")
	if !c.MemorySet || c.MemoryBytes != 12*GiB || c.Processors != 8 || !c.NestedVirtualization {
		t.Fatalf("got %+v", c)
	}
	if c := ParseWSLConfig("[wsl2]\nmemory=lots\nprocessors=0\n"); c.MemorySet || c.ProcSet {
		t.Fatalf("a bad value must be ignored: %+v", c)
	}
}

func TestDeclaredUsesDefaultsWhenSilent(t *testing.T) {
	m, c := WSLConfig{}.Declared(32*GiB, 16)
	if m != 16*GiB || c != 16 {
		t.Fatalf("defaults %d %d", m, c)
	}
	m, c = ParseWSLConfig("[wsl2]\nmemory=8GB\nprocessors=4").Declared(32*GiB, 16)
	if m != 8*GiB || c != 4 {
		t.Fatalf("declared %d %d", m, c)
	}
}

func TestDeclaredAboveMachineIsRefused(t *testing.T) {
	c := ParseWSLConfig("[wsl2]\nmemory=64GB\n")
	if r := c.Refusal(32*GiB, 16); !strings.Contains(r, "memory") {
		t.Fatalf("refusal %q", r)
	}
	if r := ParseWSLConfig("[wsl2]\nprocessors=32").Refusal(32*GiB, 16); !strings.Contains(r, "processors") {
		t.Fatalf("refusal %q", r)
	}
	if ParseWSLConfig("[wsl2]\nmemory=8GB").Refusal(32*GiB, 16) != "" {
		t.Fatal("a fitting value is not refused")
	}
}

func TestParseSize(t *testing.T) {
	for in, want := range map[string]int64{"8GB": 8 * GiB, "512MB": 512 << 20, "6 GiB": 6 * GiB, "4096": 4096, "1.5GB": GiB * 3 / 2} {
		if got, ok := ParseSize(in); !ok || got != want {
			t.Errorf("%s = %d %v", in, got, ok)
		}
	}
	if _, ok := ParseSize("x"); ok {
		t.Error("x parsed")
	}
}

// R5.54, runners R5.53
func TestCPUSplitAndEnv(t *testing.T) {
	if PerRunner(8, 2) != 4 || PerRunner(3, 4) != 1 || PerRunner(8, 0) != 8 {
		t.Fatal("split")
	}
	if Env(4)[EnvMaxParallel] != "4" || Env(0)[EnvMaxParallel] != "1" {
		t.Fatal("env")
	}
	if CPUSet(4) != "0-3" || CPUSet(1) != "0" {
		t.Fatal("cpuset")
	}
}

// R5.58
func TestPoolSizeThatFitsIsAccepted(t *testing.T) {
	r := Check(box(), Request{MemGiB: 16, CPUs: 8})
	if !r.OK || r.Decided != "fits" {
		t.Fatalf("%+v", r)
	}
	if r.TotalGiB != 32 || r.UsedOutsideGiB != 6 || r.CPUBudget != 9 || r.RoomGiB < 21 || r.RoomGiB > 21.3 {
		t.Fatalf("inputs not shown: %+v", r)
	}
}

func TestMemoryBudgetRefusalNamesNearestSize(t *testing.T) {
	r := Check(box(), Request{MemGiB: 24, CPUs: 8})
	if r.OK || r.Short != "memory" || len(r.Nearest) == 0 || !strings.Contains(r.Nearest[0], "21 GiB fits 9 CPUs") {
		t.Fatalf("%+v", r)
	}
}

func TestCPUBudgetRefusal(t *testing.T) {
	r := Check(box(), Request{MemGiB: 20, CPUs: 12})
	if r.OK || r.Short != "cpu" || !strings.Contains(r.Reason, "60%") {
		t.Fatalf("%+v", r)
	}
}

func TestRatioRefusalSaysTheNeed(t *testing.T) {
	r := Check(box(), Request{MemGiB: 10, CPUs: 7})
	if r.OK || r.Short != "ratio" || r.Reason != "10 GiB fits 6 CPUs; 7 CPUs needs 10.5 GiB" {
		t.Fatalf("%+v", r)
	}
}

func TestFloors(t *testing.T) {
	for _, q := range []Request{{MemGiB: 3, CPUs: 2}, {MemGiB: 8, CPUs: 1}} {
		if r := Check(box(), q); r.OK || r.Short != "floor" {
			t.Fatalf("%+v", r)
		}
	}
	if r := Check(box(), Request{MemGiB: 4, CPUs: 2}); !r.OK {
		t.Fatalf("the floor itself fits: %+v", r)
	}
}

func TestGuestsAndOutsideUseShrinkTheRoom(t *testing.T) {
	in := box()
	in.GuestBytes = 8 * GiB
	if r := Check(in, Request{MemGiB: 16, CPUs: 8}); r.OK || r.Short != "memory" {
		t.Fatalf("guests must count: %+v", r)
	}
}

func TestDockerCeiling(t *testing.T) {
	in := box()
	in.DockerCeilingBytes = 8 * GiB
	if r := Check(in, Request{MemGiB: 12, CPUs: 6}); r.OK || r.Short != "docker" {
		t.Fatalf("%+v", r)
	}
}

func TestShrinkNeedsExplicitConfirm(t *testing.T) {
	q := Request{MemGiB: 8, CPUs: 4, CurMemGiB: 16, CurCPUs: 8}
	r := Check(box(), q)
	if r.OK || !r.NeedsShrinkConfirm {
		t.Fatalf("a shrink must wait for a confirm: %+v", r)
	}
	q.ConfirmShrink = true
	if r = Check(box(), q); !r.OK {
		t.Fatalf("confirmed shrink: %+v", r)
	}
	// Lowering only one dimension is a shrink too; growing is not.
	if r = Check(box(), Request{MemGiB: 16, CPUs: 4, CurMemGiB: 16, CurCPUs: 8}); !r.NeedsShrinkConfirm {
		t.Fatal("CPU-only shrink")
	}
	if r = Check(box(), Request{MemGiB: 20, CPUs: 8, CurMemGiB: 16, CurCPUs: 8}); !r.OK {
		t.Fatalf("growth: %+v", r)
	}
}

func TestRefusedSizeIsNotAShrinkQuestion(t *testing.T) {
	r := Check(box(), Request{MemGiB: 3, CPUs: 2, CurMemGiB: 16, CurCPUs: 8})
	if r.NeedsShrinkConfirm || r.OK {
		t.Fatalf("%+v", r)
	}
}

func TestDefaultBudgets(t *testing.T) {
	in := box()
	in.BudgetMemPct, in.BudgetCPUPct = 0, 0
	if r := Check(in, Request{MemGiB: 16, CPUs: 8}); !r.OK || r.CPUBudget != 9 {
		t.Fatalf("%+v", r)
	}
}
