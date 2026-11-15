package runners

import (
	"os"
	"regexp"
	"strings"
	"testing"
)

const baseDockerfile = "../../images/linux-base/Dockerfile"

func readDockerfile(t *testing.T) string { return readFile(t, baseDockerfile) }

func readFile(t *testing.T, path string) string {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return strings.ReplaceAll(string(b), "\r\n", "\n")
}

// TestBaseImageToolListAndSelfCheck keeps the Dockerfile to runners R5.49: a
// pinned base digest, the tool list, a hash on every download, a non-root job
// user with no sudo, and a build-time self-check of each tool.
func TestBaseImageToolListAndSelfCheck(t *testing.T) {
	d := readDockerfile(t)
	if !regexp.MustCompile(`(?m)^FROM ubuntu:24\.04@sha256:[0-9a-f]{64}$`).MatchString(d) {
		t.Error("base image is not pinned by digest")
	}
	for _, pkg := range []string{"build-essential", "ca-certificates", "curl", "git", "jq", "libatomic1", "libicu74", "pkg-config", "postgresql-client", "python3", "unzip", "xz-utils", "zip"} {
		if !strings.Contains(d, pkg) {
			t.Errorf("package %s missing", pkg)
		}
	}
	for _, arg := range []string{"NODE_SHA256_AMD64", "NODE_SHA256_ARM64", "COREPACK_SHA256", "GH_SHA256_AMD64", "GH_SHA256_ARM64"} {
		m := regexp.MustCompile(`(?m)^ARG ` + arg + `=([0-9a-f]+)$`).FindStringSubmatch(d)
		if m == nil || !ValidSHA256(m[1]) {
			t.Errorf("%s is not a valid pinned SHA-256", arg)
		}
	}
	if got := strings.Count(d, "sha256sum -c -"); got < 3 {
		t.Errorf("%d hash checks, want one per download (3)", got)
	}
	if regexp.MustCompile(`\|\s*(sh|bash)\b`).MatchString(d) {
		t.Error("a download is piped to a shell")
	}
	// Node first on PATH, corepack enable once at build time as root, before USER.
	enable, user := strings.Index(d, "corepack enable"), strings.Index(d, "\nUSER runner")
	if enable < 0 || user < 0 || enable > user {
		t.Error("corepack enable must run at build time as root, before USER")
	}
	if !strings.Contains(d, "PATH=/usr/local/bin:") {
		t.Error("/usr/local/bin is not first on PATH")
	}
	for _, check := range []string{"node --version", "corepack --version", "gh --version", `command -v pnpm`, "ldconfig -p | grep -q libatomic", "crsp version"} {
		if !strings.Contains(d, check) {
			t.Errorf("self-check %q missing", check)
		}
	}
	// Fixed non-root job user, no sudo.
	if !strings.Contains(d, "useradd --uid") || !strings.Contains(d, "USER runner") || strings.Contains(d, "install -y sudo") || !strings.Contains(d, "! command -v sudo") {
		t.Error("job user rules broken")
	}
	// R5.48: the crsp binary is copied in.
	if !strings.Contains(d, "COPY --chmod=0755 crsp /usr/local/bin/crsp") {
		t.Error("crsp is not copied into the image")
	}
}
