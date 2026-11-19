package container

import (
	"slices"
	"strings"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/images"
)

// R5.93: one long-lived container, restarted unless stopped, caps from the
// pool size, and the hardening of every container run.
func TestPersistentRunArgsAreLongLivedAndSafe(t *testing.T) {
	a, err := PersistentRunArgs(PersistentSpec{ImageTag: "crsp-linux-base:abc", ImageKey: "abc", Limits: Limits{MemoryMB: 8192, CPUs: 4}, UID: 20007})
	if err != nil {
		t.Fatal(err)
	}
	line := strings.Join(a, " ")
	for _, want := range []string{"--restart unless-stopped", "--init", "--user 20007:20007", "--cap-drop ALL", "--read-only",
		"--memory 8192m", "--cpus 4", "-v " + PersistentPool + "-state:/state", "-v " + PersistentPool + "-deps:/deps"} {
		if !strings.Contains(line, want) {
			t.Errorf("run args lack %q: %s", want, line)
		}
	}
	for _, never := range []string{"--privileged", "docker.sock", "--ephemeral", "--cap-add"} {
		if strings.Contains(line, never) {
			t.Errorf("run args hold %q", never)
		}
	}
	if err := CheckRunArgs(a); err != nil {
		t.Fatal(err)
	}
	if _, err := PersistentRunArgs(PersistentSpec{}); err == nil {
		t.Error("a container without an image was built")
	}
}

func TestOwnVolumesIsOneShotWithOnlyChown(t *testing.T) {
	a := ownVolumesArgs("img", 1001)
	if !slices.Contains(a, "--network") || !slices.Contains(a, "CHOWN") || slices.Contains(a, "--privileged") {
		t.Fatalf("%v", a)
	}
}

func TestParsePersistentStates(t *testing.T) {
	got := ParsePersistentStates("r1|2048|\nr2|0|the clean-up of the last job left /tmp/x in place\n\njunk\n")
	if len(got) != 2 || got[0].DependencyBytes != 2048 || got[0].UncleanReason != "" || got[1].UncleanReason == "" {
		t.Fatalf("%+v", got)
	}
}

// The compose file is the readable form of the run options.
func TestComposeFileStatesTheSameOptions(t *testing.T) {
	b, err := images.FS.ReadFile("persistent/compose.yaml")
	if err != nil {
		t.Fatal(err)
	}
	s := string(b)
	for _, want := range []string{"restart: unless-stopped", "read_only: true", "cap_drop: [ALL]", "no-new-privileges", "mem_limit", "cpus:"} {
		if !strings.Contains(s, want) {
			t.Errorf("compose.yaml lacks %q", want)
		}
	}
	if strings.Contains(s, "privileged: true") || strings.Contains(s, "docker.sock") {
		t.Error("compose.yaml is not safe")
	}
}

// Every script of the container is embedded.
func TestPersistentScriptsAreEmbedded(t *testing.T) {
	for _, n := range persistentFiles {
		if b, err := images.FS.ReadFile("persistent/" + n); err != nil || len(b) == 0 {
			t.Errorf("%s: %v", n, err)
		}
	}
}
