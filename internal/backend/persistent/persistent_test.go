package persistent

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys/sysfake"
)

func meta() Meta {
	return Meta{Name: "box-1", Account: "crsp-box-1", Folder: "/r/box-1", GitHubURL: "https://github.com/o/r",
		Labels: []string{"self-hosted", "linux"}, Service: "s"}
}

// R5.20 (port of the test_dl310 rerun tests).
func TestDecide(t *testing.T) {
	w := meta()
	cases := []struct {
		name string
		have func() *Meta
		env  string
		want Action
	}{
		{"nothing there", func() *Meta { return nil }, "", Fresh},
		{"all match", func() *Meta { m := meta(); return &m }, "E", Already},
		{"label order does not matter", func() *Meta { m := meta(); m.Labels = []string{"linux", "self-hosted"}; return &m }, "E", Already},
		{"other account", func() *Meta { m := meta(); m.Account = "old"; return &m }, "E", Reregister},
		{"other labels", func() *Meta { m := meta(); m.Labels = []string{"self-hosted"}; return &m }, "E", Reregister},
		{"other repository", func() *Meta { m := meta(); m.GitHubURL = "https://github.com/o/x"; return &m }, "E", Reregister},
		{"other symlink right", func() *Meta { m := meta(); m.SymlinkRight = true; return &m }, "E", UpdateRights},
		{"stale env only", func() *Meta { m := meta(); return &m }, "old", RewriteEnv},
		{"account beats env", func() *Meta { m := meta(); m.Account = "old"; return &m }, "old", Reregister},
	}
	for _, c := range cases {
		if got := Decide(c.have(), c.env, w, "E"); got != c.want {
			t.Errorf("%s: %s, want %s", c.name, got, c.want)
		}
	}
}

func TestEnvSortedAndServiceName(t *testing.T) {
	if got := Env(map[string]string{"B": "2", "A": "1"}); got != "A=1\nB=2\n" {
		t.Errorf("%q", got)
	}
	if got := ServiceName("https://github.com/luis-mc/demo", "box-1"); got != "actions.runner.luis-mc-demo.box-1" {
		t.Errorf("%s", got)
	}
	if got := ServiceName("https://github.com/acme", "box-1"); got != "actions.runner.acme.box-1" {
		t.Errorf("%s", got)
	}
}

func TestConfigArgsOneByOne(t *testing.T) {
	a := ConfigArgs("https://github.com/o/r", "n", "grp", []string{"self-hosted", "linux"})
	want := []string{"--unattended", "--url", "https://github.com/o/r", "--name", "n", "--labels", "self-hosted,linux",
		"--disableupdate", "--replace", "--runnergroup", "grp"}
	if strings.Join(a, "|") != strings.Join(want, "|") {
		t.Errorf("%v", a)
	}
	for _, x := range a {
		if strings.Contains(x, "TOKEN") || x == "--token" {
			t.Error("the token never goes in an argument")
		}
	}
}

func TestMetaRoundTrip(t *testing.T) {
	f := sysfake.NewFS()
	if m, err := ReadMeta(f, "/x/"+MetaFile); m != nil || err != nil {
		t.Fatalf("missing file: %v %v", m, err)
	}
	if err := WriteMeta(f, "/x/"+MetaFile, meta()); err != nil {
		t.Fatal(err)
	}
	m, err := ReadMeta(f, "/x/"+MetaFile)
	if err != nil || m.Name != "box-1" {
		t.Fatalf("%v %v", m, err)
	}
}

// R5.37: a download that does not match is deleted and refused.
func TestDownloadDeletesOnMismatch(t *testing.T) {
	f := sysfake.NewFS()
	d := sys.Deps{FS: f, Fetch: &sysfake.Fetcher{FS: f, Body: []byte("x")},
		Verify: func(string, string) error { return errors.New("mismatch") }}
	if err := Download(context.Background(), d, "u", "/a", "h"); err == nil {
		t.Fatal("want error")
	}
	if f.Exists("/a") {
		t.Error("file kept")
	}
}
