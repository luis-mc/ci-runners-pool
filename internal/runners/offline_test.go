package runners

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/github"
)

// R5.33: the yes path. Without a yes the answer names the runner and nothing
// is deleted; with it the registration, the record and the folder go.
func TestOfflineRunnerNeedsAYesThatNamesIt(t *testing.T) {
	r, api := sweepRig(t, []string{"crsp-job-1"}, []github.Runner{{ID: 100, Name: "crsp-job-1", Status: "offline"}})
	_, err := r.svc.DeleteOfflineRegistration(context.Background(), "r_0", false, "luis")
	var nc *NeedsConfirmation
	if !errors.As(err, &nc) || len(nc.Items) == 0 || !strings.Contains(nc.Items[0].Text, "crsp-job-1") {
		t.Fatalf("err = %v", err)
	}
	if len(api.deletes) != 0 {
		t.Fatalf("deleted without a yes: %v", api.deletes)
	}
	if _, err := r.svc.DeleteOfflineRegistration(context.Background(), "r_0", true, "luis"); err != nil {
		t.Fatal(err)
	}
	if len(api.deletes) != 1 || api.deletes[0] != 100 {
		t.Fatalf("deletes = %v", api.deletes)
	}
	if _, err := r.store.GetRunner(context.Background(), "r_0"); err == nil {
		t.Fatal("the record stayed")
	}
	if len(r.ag.folders) != 1 {
		t.Fatalf("clean-up %v", r.ag.folders)
	}
	assertAudit(t, r.au, "runner.delete_offline")
}

// R5.33: online, busy, unlisted and foreign runners are refused; nothing is deleted.
func TestOfflineDeleteRefusesWhatIsNotOfflineAndCrsps(t *testing.T) {
	cases := map[string]github.Runner{
		"online": {ID: 100, Name: "crsp-job-1", Status: "online"},
		"busy":   {ID: 100, Name: "crsp-job-1", Status: "offline", Busy: true},
		"other":  {ID: 999, Name: "crsp-job-1", Status: "offline"},
		"absent": {ID: 100, Name: "somebody", Status: "offline"},
	}
	for name, held := range cases {
		r, api := sweepRig(t, []string{"crsp-job-1"}, []github.Runner{held})
		_, err := r.svc.DeleteOfflineRegistration(context.Background(), "r_0", true, "luis")
		var re *RefusalError
		if !errors.As(err, &re) || len(api.deletes) != 0 {
			t.Errorf("%s: err %v deletes %v", name, err, api.deletes)
		}
	}
	r, api := sweepRig(t, []string{"crsp-job-1"}, []github.Runner{{ID: 100, Name: "crsp-job-1", Status: "offline"}})
	api.listErr = errors.New("rate limited")
	if _, err := r.svc.DeleteOfflineRegistration(context.Background(), "r_0", true, "luis"); err == nil || len(api.deletes) != 0 {
		t.Fatalf("an unreadable list must change nothing: %v %v", err, api.deletes)
	}
}
