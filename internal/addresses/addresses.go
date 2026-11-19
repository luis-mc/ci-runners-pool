// Package addresses holds the external addresses crsp calls or links to, read
// from the CRSP_GITHUB_URL family of variables (operations OPS35). It is the
// one place that holds a default address; every other package receives the
// value through its struct. It imports no other package of this module, so any
// package can use it.
package addresses

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
)

// Environment variables that name the external addresses.
const (
	EnvGitHubURL         = "CRSP_GITHUB_URL"
	EnvGitHubAPIURL      = "CRSP_GITHUB_API_URL"
	EnvRunnerDownloadURL = "CRSP_RUNNER_DOWNLOAD_URL"
)

// The defaults for github.com.
const (
	DefaultGitHubURL    = "https://github.com"
	DefaultGitHubAPIURL = "https://api.github.com"

	// runnerReleasePath is where the GitHub Actions runner releases live under
	// the GitHub address.
	runnerReleasePath = "/actions/runner/releases/download"
	// enterpriseAPIPath is GitHub Enterprise Server's REST path under its host.
	enterpriseAPIPath = "/api/v3"

	// ActionsOIDCIssuer is the OIDC issuer of GitHub Actions certificates. It is
	// a fixed identity that signed releases carry, not a host crsp calls, so it
	// never follows CRSP_GITHUB_URL.
	ActionsOIDCIssuer = "https://token.actions.githubusercontent.com"

	// ReleaseSignerSANPrefix is the start of the certificate identity (a regular
	// expression) of the release workflow that signs crsp releases. Releases are
	// built on github.com, so it never follows CRSP_GITHUB_URL.
	ReleaseSignerSANPrefix = "^https://github\\.com/"
)

// Set is the external addresses of one process, read once at start.
type Set struct {
	// GitHubURL is GitHub's web address, no trailing slash.
	GitHubURL string
	// GitHubAPIURL is GitHub's REST address, no trailing slash.
	GitHubAPIURL string
	// RunnerDownloadURL is the base the Actions runner release assets are
	// fetched from: <base>/v<version>/actions-runner-<os>-<arch>-<version>.<ext>.
	RunnerDownloadURL string
}

// Defaults are the addresses for github.com.
func Defaults() Set {
	a, _ := Load(func(string) string { return "" })
	return a
}

// Load reads and validates the address variables. Every problem is
// reported together and each message names its variable.
func Load(getenv func(string) string) (Set, error) {
	var errs []error
	read := func(name string) string {
		v := strings.TrimSpace(getenv(name))
		if v == "" {
			return ""
		}
		if err := ValidateBaseURL(v); err != nil {
			errs = append(errs, fmt.Errorf("%s: %w", name, err))
			return ""
		}
		return v
	}
	web, api, dl := read(EnvGitHubURL), read(EnvGitHubAPIURL), read(EnvRunnerDownloadURL)
	a := Set{GitHubURL: web, GitHubAPIURL: api, RunnerDownloadURL: dl}
	switch {
	case web == "":
		a.GitHubURL = DefaultGitHubURL
		if api == "" {
			a.GitHubAPIURL = DefaultGitHubAPIURL
		}
	case api == "" && web != DefaultGitHubURL:
		// A GitHub Enterprise Server host serves its API under /api/v3.
		a.GitHubAPIURL = web + enterpriseAPIPath
	case api == "":
		a.GitHubAPIURL = DefaultGitHubAPIURL
	}
	if dl == "" {
		a.RunnerDownloadURL = a.GitHubURL + runnerReleasePath
	}
	if len(errs) > 0 {
		return Set{}, errors.Join(errs...)
	}
	return a, nil
}

// ValidateBaseURL checks an address base: absolute, https (http only for
// 127.0.0.1 and localhost), a host, no query or fragment, no trailing slash.
func ValidateBaseURL(v string) error {
	u, err := url.Parse(v)
	if err != nil || u.Host == "" || u.Scheme == "" {
		return fmt.Errorf("%q is not an absolute address (https://host)", v)
	}
	local := u.Hostname() == "127.0.0.1" || u.Hostname() == "localhost"
	switch {
	case u.Scheme == "https":
	case u.Scheme == "http" && local:
	default:
		return fmt.Errorf("%q must use https (http only for 127.0.0.1 or localhost)", v)
	}
	if u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return fmt.Errorf("%q must not hold credentials, a query or a fragment", v)
	}
	if strings.HasSuffix(v, "/") {
		return fmt.Errorf("%q must not end with a slash", v)
	}
	return nil
}

// web is the GitHub address; a zero Set means github.com.
func (a Set) web() string {
	if a.GitHubURL == "" {
		return DefaultGitHubURL
	}
	return a.GitHubURL
}

// RepoPage is the GitHub page of a repository or an account ("owner/repo" or "owner").
func (a Set) RepoPage(path string) string { return a.web() + "/" + path }

// JobPage is the GitHub page of one job of a workflow run.
func (a Set) JobPage(repository string, runID, jobID int64) string {
	return fmt.Sprintf("%s/%s/actions/runs/%d/job/%d", a.web(), repository, runID, jobID)
}

// InstallPage is GitHub's page that installs an App on more repositories.
func (a Set) InstallPage(slug string) string {
	return a.web() + "/apps/" + url.PathEscape(slug) + "/installations/new"
}

// RunnerAsset is the download address of an Actions runner release asset.
func (a Set) RunnerAsset(version, osName, arch, ext string) string {
	return fmt.Sprintf("%s/v%s/actions-runner-%s-%s-%s.%s", a.RunnerDownloadURL, version, osName, arch, version, ext)
}
