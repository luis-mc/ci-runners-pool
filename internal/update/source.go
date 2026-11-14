package update

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// Repo is the repository whose stable GitHub Releases this product updates from.
const Repo = "luis-mc/ci-runners-shared-pool"

// Release is one stable release and its assets (name to download URL).
type Release struct {
	Version string // without the leading v
	Tag     string
	URL     string // the release page
	Assets  map[string]string
}

// Source finds the newest stable release (operations R5.11).
type Source interface {
	Latest(ctx context.Context) (Release, error)
}

// ErrNoRelease says GitHub has no stable release yet.
var ErrNoRelease = errors.New("no stable release found")

// GitHubSource reads GitHub Releases. Base is the API root (default
// https://api.github.com); tests point it at a fake.
type GitHubSource struct {
	Base   string
	Repo   string
	Client *http.Client
}

type ghRelease struct {
	TagName    string    `json:"tag_name"`
	Draft      bool      `json:"draft"`
	Prerelease bool      `json:"prerelease"`
	HTMLURL    string    `json:"html_url"`
	Assets     []ghAsset `json:"assets"`
}

type ghAsset struct {
	Name string `json:"name"`
	URL  string `json:"browser_download_url"`
}

// Latest asks for /releases/latest, which GitHub answers with the newest
// release that is neither a draft nor a pre-release. The edge pre-release is
// therefore never offered; a draft or pre-release in the answer is refused too.
func (g GitHubSource) Latest(ctx context.Context) (Release, error) {
	base := g.Base
	if base == "" {
		base = "https://api.github.com"
	}
	repo := g.Repo
	if repo == "" {
		repo = Repo
	}
	c := g.Client
	if c == nil {
		c = &http.Client{Timeout: 20 * time.Second}
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(base, "/")+"/repos/"+repo+"/releases/latest", nil)
	if err != nil {
		return Release{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", "crsp-updater")
	resp, err := c.Do(req)
	if err != nil {
		return Release{}, fmt.Errorf("could not reach GitHub: %w", err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode == http.StatusNotFound {
		return Release{}, ErrNoRelease
	}
	if resp.StatusCode != http.StatusOK {
		return Release{}, fmt.Errorf("GitHub answered %d", resp.StatusCode)
	}
	var r ghRelease
	if err := json.NewDecoder(io.LimitReader(resp.Body, 4<<20)).Decode(&r); err != nil {
		return Release{}, fmt.Errorf("GitHub sent an unreadable release: %w", err)
	}
	if r.Draft || r.Prerelease {
		return Release{}, ErrNoRelease
	}
	out := Release{Tag: r.TagName, Version: strings.TrimPrefix(r.TagName, "v"), URL: r.HTMLURL, Assets: map[string]string{}}
	for _, a := range r.Assets {
		out.Assets[a.Name] = a.URL
	}
	if _, ok := ParseVersion(out.Version); !ok {
		return Release{}, ErrNoRelease
	}
	return out, nil
}

// Version is a stable semantic version.
type Version struct{ Major, Minor, Patch int }

// ParseVersion reads "1.2.3" or "v1.2.3". A pre-release or build suffix, an
// edge build ("edge-abc1234") and "dev" are not stable versions.
func ParseVersion(s string) (Version, bool) {
	s = strings.TrimPrefix(strings.TrimSpace(s), "v")
	parts := strings.Split(s, ".")
	if len(parts) != 3 {
		return Version{}, false
	}
	var n [3]int
	for i, p := range parts {
		v, err := strconv.Atoi(p)
		if err != nil || v < 0 || p == "" || (len(p) > 1 && p[0] == '0') {
			return Version{}, false
		}
		n[i] = v
	}
	return Version{n[0], n[1], n[2]}, true
}

// Newer reports whether latest is a stable version above current. A current
// version that is not stable (a dev or edge build) is never offered an update
// by the automatic path, so a developer's build is not replaced.
func Newer(current, latest string) bool {
	c, ok1 := ParseVersion(current)
	l, ok2 := ParseVersion(latest)
	if !ok1 || !ok2 {
		return false
	}
	switch {
	case l.Major != c.Major:
		return l.Major > c.Major
	case l.Minor != c.Minor:
		return l.Minor > c.Minor
	}
	return l.Patch > c.Patch
}

// AssetName is the release asset this OS and architecture installs from:
// the MSI on Windows (task CRSP18), crsp-<os>-<arch>.tar.gz elsewhere.
func AssetName(goos, goarch string) string {
	if goos == "windows" {
		return "crsp-windows-" + goarch + ".msi"
	}
	return "crsp-" + goos + "-" + goarch + ".tar.gz"
}

// allowedHost says whether a download URL may be fetched: HTTPS to GitHub's own
// hosts. Tests allow their local server through Options.AllowHost.
func allowedHost(raw string) bool {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" {
		return false
	}
	switch u.Hostname() {
	case "github.com", "objects.githubusercontent.com", "release-assets.githubusercontent.com", "api.github.com":
		return true
	}
	return false
}
