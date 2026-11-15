package slots

import "testing"

func TestWeightOfClasses(t *testing.T) {
	s := Defaults()
	s.JobSlots = 4
	for _, c := range []struct {
		job   string
		class string
		w     Weight
	}{
		{"lint", "lint", Weight{1, 1}},
		{"e2e-web", "e2e", Weight{2, 2}},
		{"vm", "vm", Weight{2, 4}},
		{"deploy", "default", DefaultWeight},
	} {
		w, class := s.WeightOf(JobNames{Job: c.job})
		if w != c.w || class != c.class {
			t.Errorf("%s: got %+v %q want %+v %q", c.job, w, class, c.w, c.class)
		}
	}
	// the shard names the class too
	if w, class := s.WeightOf(JobNames{Job: "test", Shard: "e2e-2"}); class != "e2e" || w.CPU != 2 {
		t.Errorf("shard: %+v %q", w, class)
	}
}

func TestWeightCutToBudget(t *testing.T) {
	s := Defaults() // two slots
	if w, _ := s.WeightOf(JobNames{Job: "vm"}); w != (Weight{2, 2}) {
		t.Fatalf("got %+v", w)
	}
	s.Classes = []JobClass{{Name: "zero", Match: []string{"z"}, Weight: Weight{0, -3}}}
	if w, _ := s.WeightOf(JobNames{Job: "z"}); w != DefaultWeight {
		t.Fatalf("below 1 counts as 1, got %+v", w)
	}
}

func TestHeldWeightCountsCISlotsOnly(t *testing.T) {
	s := Defaults()
	s.JobSlots = 5
	held := []Slot{
		{Kind: KindCI, Job: Job{Job: "e2e"}},
		{Kind: KindCI, Job: Job{Job: "deploy"}},
		{Kind: KindHeavy, Job: Job{Job: "vm"}},
		{Kind: KindLight, Job: Job{Job: "smoke"}},
	}
	if got := s.HeldWeight(held); got != (Weight{3, 3}) {
		t.Fatalf("got %+v", got)
	}
}
