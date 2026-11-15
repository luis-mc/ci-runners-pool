package parity

import (
	"bytes"
	"errors"
	"slices"
	"strings"
	"testing"
	"time"
)

var epoch = time.Date(2026, 11, 15, 0, 0, 0, 0, time.UTC)

func smallPlan() SoakPlan {
	return SoakPlan{JobsPerClass: 20, Duration: 2 * time.Hour, P95WaitBound: time.Minute}
}

func judgeFake(t *testing.T, f FakeSource) ClassResults {
	t.Helper()
	f.Epoch = epoch
	res, err := Run(smallPlan(), f)
	if err != nil {
		t.Fatalf("Run: %v", err)
	}
	return res
}

func TestCleanSoakPasses(t *testing.T) {
	res := judgeFake(t, FakeSource{})
	if !res.Pass() {
		t.Fatalf("clean soak failed: %+v", res)
	}
	if len(res) != 3 {
		t.Fatalf("want 3 classes, got %d", len(res))
	}
	for _, c := range res {
		if c.Submitted != 20 || c.Finished != 20 || c.Lost != 0 || c.DuplicateListeners != 0 {
			t.Errorf("%s: %+v", c.Class, c)
		}
	}
}

func TestEachCriterionFailsItsClass(t *testing.T) {
	cases := []struct {
		name   string
		fault  Fault
		reason Reason
	}{
		{"lost job", FaultLostJob, ReasonLostJob},
		{"duplicate listener", FaultDuplicate, ReasonDuplicate},
		{"slow queue", FaultSlow, ReasonWaitOverBound},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			res := judgeFake(t, FakeSource{Fault: tc.fault, FaultClass: ClassVM})
			if res.Pass() {
				t.Fatal("soak passed with a fault")
			}
			for _, c := range res {
				if c.Class == ClassVM {
					if c.Pass || !slices.Contains(c.Reasons, tc.reason) {
						t.Errorf("vm: want fail with %s, got %+v", tc.reason, c)
					}
				} else if !c.Pass {
					t.Errorf("%s failed for a fault in vm: %+v", c.Class, c)
				}
			}
		})
	}
}

func TestDuplicateRunnerNameInListeners(t *testing.T) {
	plan := smallPlan()
	obs, err := FakeSource{Epoch: epoch}.Observe(plan)
	if err != nil {
		t.Fatal(err)
	}
	obs.Listeners[1].Count = 2
	res := Judge(plan, obs)
	if res.Pass() || res[1].DuplicateListeners != 1 {
		t.Fatalf("a runner name answered twice must fail: %+v", res[1])
	}
}

func TestTooFewJobsAndNoWait(t *testing.T) {
	plan := smallPlan()
	obs, _ := FakeSource{Epoch: epoch}.Observe(plan)
	var kept []Job
	for _, j := range obs.Jobs {
		if j.Class == ClassWindows && j.ID != "windows-1" {
			continue
		}
		kept = append(kept, j)
	}
	obs.Jobs = kept
	res := Judge(plan, obs)
	if res[1].Pass || !slices.Contains(res[1].Reasons, ReasonTooFewJobs) {
		t.Errorf("one windows job of 20 must fail: %+v", res[1])
	}
	for i := range obs.Jobs {
		obs.Jobs[i].StartedAt = time.Time{}
	}
	res = Judge(plan, obs)
	if !slices.Contains(res[0].Reasons, ReasonNoWait) {
		t.Errorf("no started job must fail with no_wait_measured: %+v", res[0])
	}
}

func TestMissingClassFails(t *testing.T) {
	res := Judge(smallPlan(), Observation{})
	if res.Pass() {
		t.Fatal("an empty observation passed")
	}
	if (ClassResults{}).Pass() {
		t.Fatal("empty results must not pass")
	}
}

func TestControllerLostResultIsLost(t *testing.T) {
	plan := smallPlan()
	obs, _ := FakeSource{Epoch: epoch}.Observe(plan)
	obs.Jobs[0].Lost = true // finished, but the controller says lost
	res := Judge(plan, obs)
	if res[0].Lost != 1 || res[0].Pass {
		t.Fatalf("lost result must count: %+v", res[0])
	}
}

func TestPercentile95(t *testing.T) {
	var waits []time.Duration
	for i := 1; i <= 100; i++ {
		waits = append(waits, time.Duration(i)*time.Second)
	}
	if got := Percentile95(waits); got != 95*time.Second {
		t.Errorf("p95 of 1..100 s: got %v", got)
	}
	if Percentile95(nil) != 0 {
		t.Error("p95 of nothing must be 0")
	}
	if got := Percentile95([]time.Duration{7 * time.Second}); got != 7*time.Second {
		t.Errorf("p95 of one: got %v", got)
	}
	// Exactly on the bound passes; one second over fails.
	plan := SoakPlan{JobsPerClass: 1, Duration: time.Hour, P95WaitBound: 10 * time.Second}
	for wait, want := range map[time.Duration]bool{10 * time.Second: true, 11 * time.Second: false} {
		obs, _ := FakeSource{Epoch: epoch, Wait: wait}.Observe(plan)
		if got := Judge(plan, obs).Pass(); got != want {
			t.Errorf("wait %v: pass=%t want %t", wait, got, want)
		}
	}
}

func TestPlanValidate(t *testing.T) {
	if err := DefaultPlan().Validate(); err != nil {
		t.Fatalf("default plan: %v", err)
	}
	err := SoakPlan{}.Validate()
	if err == nil || strings.Count(err.Error(), "\n") != 2 {
		t.Fatalf("want three problems, got %v", err)
	}
	if _, err := Run(SoakPlan{}, FakeSource{}); err == nil {
		t.Error("Run accepted an empty plan")
	}
	if _, err := Run(smallPlan(), nil); !errors.Is(err, ErrNoSource) {
		t.Errorf("want ErrNoSource, got %v", err)
	}
}

func goodSnapshot() PoolSnapshot {
	return PoolSnapshot{Runners: []RunnerInfo{
		{Name: "a", Class: ClassLinuxContainer, Online: true},
		{Name: "w", Class: ClassWindows, Online: true},
		{Name: "v", Class: ClassVM, Online: true},
	}, Findings: []Finding{{Severity: "ok", Title: "fine"}}}
}

func statusOf(cs []Check, id string) Status {
	for _, c := range cs {
		if c.ID == id {
			return c.Status
		}
	}
	return ""
}

func TestCheckPool(t *testing.T) {
	for _, c := range CheckPool(goodSnapshot()) {
		if c.Status != StatusPass {
			t.Errorf("%s: %s %s", c.ID, c.Status, c.Detail)
		}
	}
	s := goodSnapshot()
	s.Runners[2].Online = false
	s.Runners = append(s.Runners, RunnerInfo{Name: "a", Class: ClassLinuxContainer, Online: true})
	s.Findings = append(s.Findings, Finding{Severity: "warn", Title: "disk"})
	cs := CheckPool(s)
	for _, id := range []string{"pool.runners.vm", "pool.listeners", "pool.doctor"} {
		if statusOf(cs, id) != StatusFail {
			t.Errorf("%s should fail: %+v", id, cs)
		}
	}
	if statusOf(cs, "pool.runners.windows") != StatusPass {
		t.Error("windows should pass")
	}
}

func TestClassOf(t *testing.T) {
	cases := []struct {
		os, iso string
		labels  []string
		want    Class
		ok      bool
	}{
		{"linux", "container", nil, ClassLinuxContainer, true},
		{"windows", "persistent", nil, ClassWindows, true},
		{"linux", "VM", nil, ClassVM, true},
		{"linux", "container", []string{"self-hosted", "kvm"}, ClassVM, true},
		{"macos", "persistent", nil, "", false},
	}
	for _, tc := range cases {
		got, ok := ClassOf(tc.os, tc.iso, tc.labels)
		if got != tc.want || ok != tc.ok {
			t.Errorf("%v: got %q %t", tc, got, ok)
		}
	}
}

func TestReportEvaluate(t *testing.T) {
	good := func(mode Mode) Report {
		r := NewReport(mode, epoch)
		r.Checks = CheckPool(goodSnapshot())
		r.Soak = judgeFake(t, FakeSource{})
		r.Evaluate()
		return r
	}
	if r := good(ModeSoak); !r.Pass || !r.CountsForGate {
		t.Errorf("live clean soak: %+v", r)
	}
	if r := good(ModeDryRun); !r.Pass || r.CountsForGate {
		t.Errorf("a dry run must pass but never count: %+v", r)
	}
	r := NewReport(ModeCheck, epoch)
	r.Checks = CheckPool(goodSnapshot())
	r.Evaluate()
	if !r.Pass || r.CountsForGate {
		t.Errorf("check only passes, never counts: %+v", r)
	}
	// A failed check or class fails the report and names why.
	bad := good(ModeSoak)
	bad.Checks[0].Status = StatusFail
	bad.Soak = judgeFake(t, FakeSource{Fault: FaultLostJob})
	bad.Evaluate()
	if bad.Pass || bad.CountsForGate || len(bad.Failures) < 2 {
		t.Errorf("bad report: %+v", bad)
	}
	skip := good(ModeSoak)
	skip.Checks[0].Status = StatusSkip
	skip.Evaluate()
	if skip.Pass {
		t.Error("a skipped check must not pass")
	}
	empty := NewReport(ModeCheck, epoch)
	empty.Evaluate()
	if empty.Pass {
		t.Error("an empty report must not pass")
	}
}

func TestReportRoundTrip(t *testing.T) {
	r := NewReport(ModeDryRun, epoch)
	plan := smallPlan()
	r.Plan = &plan
	r.Soak = judgeFake(t, FakeSource{})
	r.Evaluate()
	var buf bytes.Buffer
	if err := r.WriteJSON(&buf); err != nil {
		t.Fatal(err)
	}
	back, err := ReadReport(&buf)
	if err != nil {
		t.Fatal(err)
	}
	if back.Pass != r.Pass || len(back.Soak) != 3 || back.Mode != ModeDryRun {
		t.Errorf("round trip: %+v", back)
	}
	if _, err := ReadReport(strings.NewReader(`{"schema":9}`)); err == nil {
		t.Error("a wrong schema was accepted")
	}
	if _, err := ReadReport(strings.NewReader(`{"schema":1,"extra":1}`)); err == nil {
		t.Error("an unknown field was accepted")
	}
	md := r.Markdown()
	if !strings.Contains(md, "PASS") || !strings.Contains(md, "linux-container") {
		t.Errorf("markdown: %s", md)
	}
}
