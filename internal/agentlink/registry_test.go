package agentlink

import (
	"context"
	"testing"
	"time"

	agentv1 "github.com/luis-mc/ci-runners-shared-pool/internal/gen/agent/v1"
)

type fakeRegistry struct {
	pulls chan *agentv1.PullReport
}

func (f *fakeRegistry) EnsureImage(_ context.Context, _ string, req *agentv1.EnsureImage) *agentv1.EnsureImageAnswer {
	return &agentv1.EnsureImageAnswer{RequestId: "ignored", Outcome: agentv1.EnsureImageAnswer_OUTCOME_FOUND,
		Name: "crsp/std/node-web", ManifestDigest: "sha256:" + req.GetKey()}
}

func (f *fakeRegistry) RegistryToken(_ context.Context, machineID string, req *agentv1.RegistryTokenRequest) *agentv1.RegistryToken {
	return &agentv1.RegistryToken{Token: "t-" + machineID}
}

func (f *fakeRegistry) PushReport(context.Context, string, *agentv1.PushReport) {}

func (f *fakeRegistry) PullReport(_ context.Context, _ string, rep *agentv1.PullReport) {
	f.pulls <- rep
}

func registryLink(sink RegistrySink) (*Link, chan *agentv1.SessionResponse) {
	sent := make(chan *agentv1.SessionResponse, 4)
	l := New(sendFn(func(_ string, m *agentv1.SessionResponse) error { sent <- m; return nil }))
	l.Registry = sink
	return l, sent
}

func next(t *testing.T, ch chan *agentv1.SessionResponse) *agentv1.SessionResponse {
	t.Helper()
	select {
	case m := <-ch:
		return m
	case <-time.After(5 * time.Second):
		t.Fatal("no answer")
		return nil
	}
}

// Without a registry the controller says "not in the registry" and gives no
// staging name, so the agent builds as before and pushes nothing.
func TestRegistryStubAnswersNotFoundAndRefusesTokens(t *testing.T) {
	l, sent := registryLink(nil)
	if !l.OnMessage("m1", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_EnsureImage{EnsureImage: &agentv1.EnsureImage{RequestId: "r1", Key: "c57a886d9402", Arch: "amd64"}}}) {
		t.Fatal("EnsureImage not handled")
	}
	a := next(t, sent).GetEnsureImageAnswer()
	if a.GetRequestId() != "r1" || a.GetOutcome() != agentv1.EnsureImageAnswer_OUTCOME_NOT_FOUND || a.GetStagingName() != "" {
		t.Fatalf("answer %v", a)
	}
	l.OnMessage("m1", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_RegistryTokenRequest{RegistryTokenRequest: &agentv1.RegistryTokenRequest{RequestId: "r2"}}})
	tok := next(t, sent).GetRegistryGrant()
	if tok.GetRequestId() != "r2" || tok.GetToken() != "" || tok.GetRefused() == "" {
		t.Fatalf("token %v", tok)
	}
	for _, m := range []*agentv1.SessionRequest{
		{Message: &agentv1.SessionRequest_PushReport{PushReport: &agentv1.PushReport{}}},
		{Message: &agentv1.SessionRequest_PullReport{PullReport: &agentv1.PullReport{}}},
	} {
		if !l.OnMessage("m1", m) {
			t.Fatalf("%T not handled", m.GetMessage())
		}
	}
}

func TestRegistrySinkAnswersKeepTheRequestID(t *testing.T) {
	f := &fakeRegistry{pulls: make(chan *agentv1.PullReport, 1)}
	l, sent := registryLink(f)
	l.OnMessage("m1", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_EnsureImage{EnsureImage: &agentv1.EnsureImage{RequestId: "r1", Key: "k"}}})
	if a := next(t, sent).GetEnsureImageAnswer(); a.GetRequestId() != "r1" || a.GetManifestDigest() != "sha256:k" {
		t.Fatalf("answer %v", a)
	}
	l.OnMessage("m9", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_RegistryTokenRequest{RegistryTokenRequest: &agentv1.RegistryTokenRequest{RequestId: "r2"}}})
	if tok := next(t, sent).GetRegistryGrant(); tok.GetRequestId() != "r2" || tok.GetToken() != "t-m9" {
		t.Fatalf("token %v", tok)
	}
	l.OnMessage("m1", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_PullReport{PullReport: &agentv1.PullReport{PullId: "p1"}}})
	select {
	case p := <-f.pulls:
		if p.GetPullId() != "p1" {
			t.Fatal(p)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("pull report not passed on")
	}
}

func TestSupportsRegistryFollowsTheMachineReport(t *testing.T) {
	l, _ := registryLink(nil)
	if l.SupportsRegistry("m1") {
		t.Fatal("no report yet")
	}
	l.OnMessage("m1", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_MachineReport{MachineReport: &agentv1.MachineReport{Registry: true}}})
	l.OnMessage("m2", &agentv1.SessionRequest{Message: &agentv1.SessionRequest_MachineReport{MachineReport: &agentv1.MachineReport{}}})
	if !l.SupportsRegistry("m1") || l.SupportsRegistry("m2") {
		t.Fatal("SupportsRegistry")
	}
}
