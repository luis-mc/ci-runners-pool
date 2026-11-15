package runners

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
)

// Layer names (runners R5.50). The browsers layer is R5.44.
const (
	LayerBrowsers = "browsers"
)

// PlaywrightPin is the Playwright version the browsers layer is built with
// unless a pool already has a higher one (runners R5.44).
const PlaywrightPin = "1.65.1"

// Layer is one image layer: its name, the folder of its Dockerfile and the
// version it pins.
type Layer struct {
	Name       string
	Dockerfile string
	Version    string
}

// KnownLayers are the layers this release can build.
var KnownLayers = []Layer{
	{Name: LayerBrowsers, Dockerfile: "images/layers/browsers/Dockerfile", Version: PlaywrightPin},
}

// PoolLayers is what a pool asks for: layer names it turned on, and the
// Playwright version its last image was built with ("" when none).
type PoolLayers struct {
	Enabled           []string
	PlaywrightCurrent string
	PlaywrightWanted  string // "" means the pin
}

// SelectedLayer is a layer chosen for one pool's image build.
type SelectedLayer struct {
	Layer
	// Held is true when the version is the pool's current one, kept because the
	// wanted one is lower.
	Held bool
}

// SelectLayers returns the layers to build on top of the base image for one
// pool, in a stable order, and refuses a name it does not know. A layer that is
// not turned on is not built (runners R5.50: a layer is off until turned on).
func SelectLayers(p PoolLayers) ([]SelectedLayer, error) {
	known := map[string]Layer{}
	for _, l := range KnownLayers {
		known[l.Name] = l
	}
	seen := map[string]bool{}
	var names []string
	for _, n := range p.Enabled {
		n = strings.TrimSpace(n)
		if n == "" || seen[n] {
			continue
		}
		if _, ok := known[n]; !ok {
			return nil, refuse("layer %q is not one this release builds", n)
		}
		seen[n] = true
		names = append(names, n)
	}
	sort.Strings(names)
	var out []SelectedLayer
	for _, n := range names {
		l := known[n]
		s := SelectedLayer{Layer: l}
		if n == LayerBrowsers {
			want := p.PlaywrightWanted
			if want == "" {
				want = l.Version
			}
			v, held, err := NeverLower(p.PlaywrightCurrent, want)
			if err != nil {
				return nil, err
			}
			s.Version, s.Held = v, held
		}
		out = append(out, s)
	}
	return out, nil
}

// NeverLower picks the Playwright version of a rebuild: the wanted one, unless
// the pool's current one is higher, which then stays (held is true). A rebuild
// never lowers it (runners R5.44; parity plan row 24). An empty current takes
// the wanted version. A version that is not dotted numbers is refused and
// nothing changes.
func NeverLower(current, wanted string) (version string, held bool, err error) {
	w, err := parseVersion(wanted)
	if err != nil {
		return "", false, refuse("Playwright version %q: %v", wanted, err)
	}
	if strings.TrimSpace(current) == "" {
		return wanted, false, nil
	}
	c, err := parseVersion(current)
	if err != nil {
		return "", false, refuse("Playwright version %q: %v", current, err)
	}
	if compareVersions(c, w) > 0 {
		return strings.TrimSpace(current), true, nil
	}
	return strings.TrimSpace(wanted), false, nil
}

func parseVersion(s string) ([]int, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, fmt.Errorf("is empty")
	}
	parts := strings.Split(s, ".")
	if len(parts) < 2 || len(parts) > 3 {
		return nil, fmt.Errorf("is not major.minor or major.minor.patch")
	}
	out := make([]int, 3)
	for i, p := range parts {
		n, err := strconv.Atoi(p)
		if err != nil || n < 0 || p != strconv.Itoa(n) {
			return nil, fmt.Errorf("has a part that is not a plain number")
		}
		out[i] = n
	}
	return out, nil
}

func compareVersions(a, b []int) int {
	for i := range a {
		if a[i] != b[i] {
			if a[i] < b[i] {
				return -1
			}
			return 1
		}
	}
	return 0
}

// BuildArgs gives the docker build arguments of a selected layer.
func (s SelectedLayer) BuildArgs(baseImage string) []string {
	args := []string{"--build-arg", "BASE_IMAGE=" + baseImage}
	if s.Name == LayerBrowsers {
		args = append(args, "--build-arg", "PLAYWRIGHT_VERSION="+s.Version)
	}
	return args
}
