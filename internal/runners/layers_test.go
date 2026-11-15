package runners

import (
	"errors"
	"regexp"
	"strings"
	"testing"
)

func TestSelectLayersOffUntilTurnedOn(t *testing.T) {
	got, err := SelectLayers(PoolLayers{})
	if err != nil || len(got) != 0 {
		t.Fatalf("got %v %v", got, err)
	}
	got, err = SelectLayers(PoolLayers{Enabled: []string{"browsers", " browsers ", ""}})
	if err != nil || len(got) != 1 || got[0].Name != LayerBrowsers || got[0].Version != PlaywrightPin || got[0].Held {
		t.Fatalf("got %+v %v", got, err)
	}
}

func TestSelectLayersRefusesUnknown(t *testing.T) {
	_, err := SelectLayers(PoolLayers{Enabled: []string{"kvm"}})
	var r *RefusalError
	if !errors.As(err, &r) {
		t.Fatalf("want refusal, got %v", err)
	}
}

func TestNeverLowerPlaywright(t *testing.T) {
	cases := []struct {
		cur, want, out string
		held           bool
	}{
		{"", "1.65.1", "1.65.1", false},
		{"1.50.0", "1.65.1", "1.65.1", false},
		{"1.65.1", "1.65.1", "1.65.1", false},
		{"1.70.0", "1.65.1", "1.70.0", true},
		{"2.0.0", "1.99.9", "2.0.0", true},
		{"1.9.0", "1.10.0", "1.10.0", false}, // numeric, not text, order
	}
	for _, c := range cases {
		v, held, err := NeverLower(c.cur, c.want)
		if err != nil || v != c.out || held != c.held {
			t.Errorf("NeverLower(%q,%q) = %q,%v,%v; want %q,%v", c.cur, c.want, v, held, err, c.out, c.held)
		}
	}
	for _, bad := range [][2]string{{"", "latest"}, {"1.x", "1.65.1"}, {"1.65.1", ""}, {"01.2.3", "1.2.3"}} {
		if _, _, err := NeverLower(bad[0], bad[1]); err == nil {
			t.Errorf("NeverLower(%q,%q) accepted", bad[0], bad[1])
		}
	}
}

func TestRebuildKeepsHigherPlaywright(t *testing.T) {
	got, err := SelectLayers(PoolLayers{Enabled: []string{"browsers"}, PlaywrightCurrent: "1.70.0"})
	if err != nil || got[0].Version != "1.70.0" || !got[0].Held {
		t.Fatalf("pin must not lower: %+v %v", got, err)
	}
	args := strings.Join(got[0].BuildArgs("base:x"), " ")
	if !strings.Contains(args, "PLAYWRIGHT_VERSION=1.70.0") || !strings.Contains(args, "BASE_IMAGE=base:x") {
		t.Fatal(args)
	}
}

// TestPlaywrightLayerSelfCheck keeps the layer Dockerfile to R5.44: on the base
// image, version pinned and passed in, the fixed path, three browsers with
// system packages, a headless launch of each at build time.
func TestPlaywrightLayerSelfCheck(t *testing.T) {
	d := readFile(t, "../../images/layers/browsers/Dockerfile")
	for _, want := range []string{
		"ARG BASE_IMAGE", "FROM ${BASE_IMAGE}", "ARG PLAYWRIGHT_VERSION=",
		"PLAYWRIGHT_BROWSERS_PATH=/opt/crsp/browsers", "install-deps chromium firefox webkit", "for b in chromium firefox webkit",
		"pw.chromium, pw.firefox, pw.webkit", "headless: true", "process.exit(1)", "USER runner",
	} {
		if !strings.Contains(d, want) {
			t.Errorf("layer Dockerfile lacks %q", want)
		}
	}
	m := regexp.MustCompile(`(?m)^ARG PLAYWRIGHT_VERSION=(\S+)$`).FindStringSubmatch(d)
	if m == nil || m[1] != PlaywrightPin {
		t.Errorf("Dockerfile pin %v differs from PlaywrightPin %s", m, PlaywrightPin)
	}
	if regexp.MustCompile(`\|\s*(sh|bash)\b`).MatchString(strings.ReplaceAll(d, "set -o pipefail", "")) &&
		regexp.MustCompile(`curl[^\n]*\|\s*(sh|bash)`).MatchString(d) {
		t.Error("a download is piped to a shell")
	}
	if KnownLayers[0].Dockerfile != "images/layers/browsers/Dockerfile" {
		t.Error("layer table points at another file")
	}
}
