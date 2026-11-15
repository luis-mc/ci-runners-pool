package runners

import (
	"context"
	"testing"
)

// runners R5.68: routing ignores names.
func TestRoutingIgnoresNames(t *testing.T) {
	ctx := context.Background()
	st := NewMemStore()
	svc := &Service{Store: st}
	must := func(r Record) {
		t.Helper()
		if err := st.InsertRunner(ctx, r); err != nil {
			t.Fatal(err)
		}
	}
	// A name that looks light but whose route is CI, and the reverse.
	must(Record{ID: "a", Name: "crsp-light-fake", MachineID: "m1", Route: Route{Queue: QueueCI}})
	must(Record{ID: "b", Name: "plain-name", MachineID: "m1", Route: Route{Queue: QueueLight}})
	must(Record{ID: "c", Name: "legacy-empty", MachineID: "m1"})
	if svc.RunsLight(ctx, "m1", "crsp-light-fake") {
		t.Fatal("light looking name with CI route was routed light")
	}
	if !svc.RunsLight(ctx, "m1", "plain-name") {
		t.Fatal("light route with a plain name was not routed light")
	}
	if svc.RunsLight(ctx, "m1", "legacy-empty") || svc.RunsLight(ctx, "m1", "missing") || svc.RunsLight(ctx, "m2", "plain-name") {
		t.Fatal("empty route, unknown runner or other machine must be CI")
	}
	// Matching a need never looks at the name either.
	if !Matches(Record{Name: "crsp-light-x", Route: Route{Queue: QueueLight}}, Need{Queue: QueueLight}) ||
		Matches(Record{Name: "crsp-light-x"}, Need{Queue: QueueLight}) {
		t.Fatal("Matches read the name")
	}
	// A rename keeps the route.
	r, err := st.GetRunner(ctx, "b")
	if err != nil {
		t.Fatal(err)
	}
	r.Name = "renamed"
	if !Matches(r, Need{Queue: QueueLight}) {
		t.Fatal("rename moved the runner")
	}
}

func TestRouteValidate(t *testing.T) {
	if (Route{Queue: "bogus"}).Validate() == nil || (Route{}).Validate() != nil || (Route{Queue: QueueLight}).Validate() != nil {
		t.Fatal("Validate")
	}
}

// runners R5.69: size class matching.
func TestSizeClassTableAndParse(t *testing.T) {
	tab := SizeTable()
	if len(tab) != 4 || tab[0].Class != SizeSmall || tab[3].Class != SizeXL {
		t.Fatalf("%+v", tab)
	}
	for i := 1; i < len(tab); i++ {
		if tab[i].CPUs <= tab[i-1].CPUs || tab[i].MemoryGiB <= tab[i-1].MemoryGiB {
			t.Fatalf("table must grow: %+v", tab)
		}
	}
	if c, err := ParseSize(" Large "); err != nil || c != SizeLarge {
		t.Fatalf("%v %v", c, err)
	}
	if c, err := ParseSize(""); err != nil || c != DefaultSize {
		t.Fatalf("%v %v", c, err)
	}
	if _, err := ParseSize("huge"); err == nil {
		t.Fatal("unknown class accepted")
	}
	if s, ok := SizeLarge.Spec(); !ok || s.CPUs != 8 || s.MemoryGiB != 16 {
		t.Fatalf("%+v", s)
	}
	if _, ok := SizeClass("x").Spec(); ok {
		t.Fatal("unknown spec")
	}
}

func TestSizeClassMatching(t *testing.T) {
	mk := func(name string, q Queue, c SizeClass) Record {
		return Record{ID: name, Name: name, Route: Route{Queue: q}, SizeClass: c}
	}
	cands := []Record{
		mk("xl-1", QueueCI, SizeXL), mk("large-1", QueueCI, SizeLarge), mk("small-1", QueueCI, SizeSmall),
		mk("medium-b", QueueCI, SizeMedium), mk("medium-a", QueueCI, SizeMedium), mk("light-s", QueueLight, SizeSmall),
		{ID: "none", Name: "none-set"}, // empty class is medium
	}
	for _, tc := range []struct {
		need Need
		want string
		ok   bool
	}{
		{Need{Size: SizeSmall}, "small-1", true},
		{Need{Size: SizeMedium}, "medium-a", true}, // smallest fit, then lower name
		{Need{}, "medium-a", true},                 // default is medium
		{Need{Size: SizeLarge}, "large-1", true},
		{Need{Size: SizeXL}, "xl-1", true},
		{Need{Queue: QueueLight, Size: SizeSmall}, "light-s", true},
		{Need{Queue: QueueLight, Size: SizeMedium}, "", false}, // light runner is too small
		{Need{Pool: "other"}, "", false},
	} {
		got, ok := Select(cands, tc.need)
		if ok != tc.ok || got.Name != tc.want {
			t.Errorf("%+v: got %q %v, want %q %v", tc.need, got.Name, ok, tc.want, tc.ok)
		}
	}
	if _, ok := Select(cands[:3:3][2:], Need{Size: SizeMedium}); ok {
		t.Fatal("a small runner took a medium job")
	}
	if SizeSmall.Fits("bogus") || SizeClass("bogus").Fits(SizeSmall) {
		t.Fatal("unknown class fits")
	}
}
