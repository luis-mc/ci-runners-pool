package repos

import (
	"context"
	"testing"
)

func names(rs []RepositoryView) []string {
	var out []string
	for _, r := range rs {
		out = append(out, r.Name)
	}
	return out
}

// CRSP125 (a), (b), (c): the installation shrinks to one repository and grows again.
func TestRepositoriesFollowTheInstallation(t *testing.T) {
	e := newEnv(t)
	e.world()
	ctx := context.Background()

	list := func() []RepositoryView {
		t.Helper()
		rows, err := e.svc.List(ctx, adminP, ListFilter{})
		if err != nil {
			t.Fatal(err)
		}
		return rows
	}
	if got := names(list()); len(got) != 3 {
		t.Fatalf("all three listed first: %v", got)
	}

	// (b) the owner limits the App to one repository; the user's sync drops the rest.
	e.fake.Lock(func() { delete(e.fake.Repos, 101); delete(e.fake.Repos, 102) })
	if err := e.svc.Sync(ctx, adminP); err != nil {
		t.Fatal(err)
	}
	if got := names(list()); len(got) != 1 || got[0] != "web" {
		t.Fatalf("only the repository left in the installation is listed: %v", got)
	}
	all, _ := e.store.ListRepositories(ctx, ListFilter{IncludeLeft: true})
	if len(all) != 3 {
		t.Fatalf("left repositories are kept: %+v", all)
	}
	if r, _ := e.store.GetRepository(ctx, 101); r.LeftAt.IsZero() {
		t.Fatal("a field says when it left, for the console to show")
	}

	// (c) the owner puts them back; only the App-token reconcile runs (no user sync).
	e.fake.AddRepo(101, 10, "alice", "secret", true, 1)
	e.fake.AddRepo(102, 10, "alice", "other", true)
	if err := e.svc.ReconcileInstallations(ctx); err != nil {
		t.Fatal(err)
	}
	rows := list()
	if len(rows) != 3 {
		t.Fatalf("they are back: %v", names(rows))
	}
	for _, r := range rows {
		if r.ID == 101 && r.AdminKnown {
			t.Fatal("a repository nobody synced for the user has an unknown flag, not a no")
		}
	}
	e.svc.ResolveAdmin(ctx, adminP, rows)
	for _, r := range rows {
		switch r.ID {
		case 101:
			if !r.AdminKnown || !r.UserIsAdmin {
				t.Fatalf("asked fresh, alice admins 101: %+v", r)
			}
		case 102:
			if !r.AdminKnown || r.UserIsAdmin {
				t.Fatalf("asked fresh, alice does not admin 102: %+v", r)
			}
		}
	}
}

func TestSyncOfAUserWhoSeesLessHidesNothing(t *testing.T) {
	e := newEnv(t)
	e.world()
	ctx := context.Background()
	e.tokens.m[3] = githubToken(e.fake.AddUser(3, "carol"))
	if err := e.svc.Sync(ctx, auth3); err != nil {
		t.Fatal(err)
	}
	rows, _ := e.svc.List(ctx, adminP, ListFilter{})
	if len(rows) != 3 {
		t.Fatalf("a user who sees fewer repositories hides nothing: %v", names(rows))
	}
}

func TestLeftServedRepositoryGoesOff(t *testing.T) {
	e := newEnv(t)
	e.world()
	e.turnOn(101)
	ctx := context.Background()
	e.fake.Lock(func() { delete(e.fake.Repos, 101) })
	if err := e.svc.Sync(ctx, adminP); err != nil {
		t.Fatal(err)
	}
	r, _ := e.store.GetRepository(ctx, 101)
	if r.PoolOn || r.LeftAt.IsZero() {
		t.Fatalf("a served repository that left is off and marked: %+v", r)
	}
	if !e.audit.has("pool.off|controller|alice/secret|the repository left") {
		t.Fatalf("audit says why: %v", e.audit.events)
	}
}

func TestRestartLosesFlagsAndAsksFresh(t *testing.T) {
	e := newEnv(t)
	e.world()
	ctx := context.Background()
	// A restart: a new service on the same data, no remembered flags.
	svc := New(Config{Store: e.store, GitHub: e.gh, Tokens: e.tokens, Audit: e.audit, Capacity: e.cap, Now: e.clock})
	rows, _ := svc.List(ctx, adminP, ListFilter{})
	for _, r := range rows {
		if r.AdminKnown {
			t.Fatalf("after a restart the flag is unknown: %+v", r)
		}
	}
	svc.ResolveAdmin(ctx, adminP, rows)
	for _, r := range rows {
		if !r.AdminKnown || r.UserIsAdmin != (r.ID != 102) {
			t.Fatalf("asked fresh: %+v", r)
		}
	}
	again, _ := svc.List(ctx, adminP, ListFilter{})
	for _, r := range again {
		if !r.AdminKnown {
			t.Fatalf("remembered: %+v", r)
		}
	}
}

func TestUnknownStaysUnknownWithoutToken(t *testing.T) {
	e := newEnv(t)
	e.world()
	ctx := context.Background()
	delete(e.tokens.m, 1)
	svc := New(Config{Store: e.store, GitHub: e.gh, Tokens: e.tokens, Audit: e.audit, Capacity: e.cap, Now: e.clock})
	rows, _ := svc.List(ctx, adminP, ListFilter{})
	svc.ResolveAdmin(ctx, adminP, rows)
	for _, r := range rows {
		if r.AdminKnown {
			t.Fatalf("no token, no answer: %+v", r)
		}
	}
}

func TestReconcileChangeDropsTheThrottle(t *testing.T) {
	e := newEnv(t)
	e.world()
	ctx := context.Background()
	if e.svc.LastSync(adminP.UserID).IsZero() {
		t.Fatal("synced")
	}
	e.fake.AddRepo(103, 10, "alice", "newest", true, 1)
	if err := e.svc.ReconcileInstallations(ctx); err != nil {
		t.Fatal(err)
	}
	if !e.svc.LastSync(adminP.UserID).IsZero() {
		t.Fatal("a new repository makes the next list read GitHub again")
	}
}
