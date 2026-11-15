package runners

import (
	"errors"
	"os"
	"regexp"
	"strings"
	"testing"
)

func layerFile(t *testing.T, l Layer) string {
	t.Helper()
	b, err := os.ReadFile("../../" + l.Dockerfile)
	if err != nil {
		t.Fatal(err)
	}
	return strings.ReplaceAll(string(b), "\r\n", "\n")
}

// TestLayerToolLists: each layer's Dockerfile installs the tools of R5.50.
func TestLayerToolLists(t *testing.T) {
	want := map[string][]string{
		"windows-packaging": {"dotnet-sdk-8.0", "wine", "wine64", "xvfb", "xauth", "msitools"},
		"linux-packaging": {"dpkg-dev", "rpm", "make", "checkpolicy", "selinux-policy-dev", "policycoreutils",
			"gnupg", "shellcheck", "systemd", "createrepo-c"},
		"kvm": {"qemu-system-x86", "qemu-utils", "cloud-image-utils", "openssh-client"},
	}
	for name, pkgs := range want {
		l, ok := LayerByName(name)
		if !ok {
			t.Fatalf("layer %s missing", name)
		}
		if strings.Join(l.Packages, " ") != strings.Join(pkgs, " ") {
			t.Errorf("%s packages %v, want %v", name, l.Packages, pkgs)
		}
		d := layerFile(t, l)
		for _, p := range pkgs {
			if !regexp.MustCompile(`(^|[\s\\])` + regexp.QuoteMeta(p) + `([\s\\]|$)`).MatchString(d) {
				t.Errorf("%s: Dockerfile does not install %s", name, p)
			}
		}
	}
	lp, _ := LayerByName("linux-packaging")
	if len(lp.Optional) != 1 || lp.Optional[0] != "policycoreutils-python-utils" {
		t.Errorf("optional package %v", lp.Optional)
	}
	if d := layerFile(t, lp); !strings.Contains(d, "apt-cache show policycoreutils-python-utils") {
		t.Error("the optional package is not skipped when the base lacks it")
	}
	if _, ok := LayerByName("nope"); ok {
		t.Error("unknown layer found")
	}
}

// TestLayerSelfChecks: each Dockerfile runs its main tools at build time, and
// the llvm layer pins its download by SHA-256 (R5.43, R5.37 rule).
func TestLayerSelfChecks(t *testing.T) {
	for _, l := range Layers() {
		d := layerFile(t, l)
		if !strings.Contains(d, "ARG BASE_IMAGE") || !strings.Contains(d, "FROM ${BASE_IMAGE}") {
			t.Errorf("%s: not built on the base image", l.Name)
		}
		if !regexp.MustCompile(`(?m)^USER root$`).MatchString(d) || !regexp.MustCompile(`(?m)^USER runner$`).MatchString(d) {
			t.Errorf("%s: must install as root and give the job user back", l.Name)
		}
		if regexp.MustCompile(`\|\s*(sh|bash)\b`).MatchString(d) {
			t.Errorf("%s: a download is piped to a shell", l.Name)
		}
		selfIdx := strings.Index(d, "Self-check")
		if selfIdx < 0 {
			t.Errorf("%s: no self-check", l.Name)
			continue
		}
		self := d[selfIdx:]
		for _, c := range l.SelfCheck {
			tool := strings.Fields(c)[0]
			if tool == "command" {
				tool = strings.Fields(c)[2]
			}
			if !strings.Contains(self, tool) {
				t.Errorf("%s: self-check does not run %s", l.Name, tool)
			}
		}
	}
	llvm, _ := LayerByName("llvm")
	d := layerFile(t, llvm)
	m := regexp.MustCompile(`(?m)^ARG LLVM_SHA256_AMD64=([0-9a-f]+)$`).FindStringSubmatch(d)
	if m == nil || !ValidSHA256(m[1]) {
		t.Error("the LLVM download has no valid pinned SHA-256")
	}
	if !strings.Contains(d, "sha256sum -c -") {
		t.Error("the LLVM download is not hash checked")
	}
	for _, tool := range []string{"clang-cl", "lld-link", "llvm-lib"} {
		if !strings.Contains(d, "/usr/local/bin/") || !strings.Contains(d, tool) {
			t.Errorf("llvm layer does not put %s on PATH", tool)
		}
	}
	if !strings.Contains(d, "clang-cl --version") {
		t.Error("llvm self-check must run clang-cl --version")
	}
	win, _ := LayerByName("windows-packaging")
	if got := layerFile(t, win); strings.Contains(got, "TMPDIR=") {
		t.Error("windows-packaging must not set TMPDIR (R5.42)")
	}
}

func TestLayerNamesAndReleases(t *testing.T) {
	rel := map[string]string{"windows-packaging": "v0.5.0", "linux-packaging": "v0.5.0", "llvm": "v0.5.0", "kvm": "v0.6.0"}
	if len(Layers()) != len(rel) {
		t.Fatalf("%d layers", len(Layers()))
	}
	for _, l := range Layers() {
		if rel[l.Name] != l.Release {
			t.Errorf("%s release %s", l.Name, l.Release)
		}
	}
}

// TestExtraPackageNamesChecked: R5.51.
func TestExtraPackageNamesChecked(t *testing.T) {
	got, err := ParseExtraPackages("zlib1g-dev\r\n\n# comment\nlibc++-dev\nzlib1g-dev\ng++-12.1\n")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Join(got, " ") != "g++-12.1 libc++-dev zlib1g-dev" {
		t.Errorf("got %v", got)
	}
	for text, line := range map[string]int{"ok\n-bad\n": 2, "a b\n": 1, "ok\nok2\nrm;ls": 3, "+x": 1, "x$": 1} {
		_, err := ParseExtraPackages(text)
		var pe *PackageError
		if !errors.As(err, &pe) || pe.Line != line {
			t.Errorf("%q: err %v, want line %d", text, err, line)
		}
	}
	// A name added stays until dropped.
	cur := MergeExtraPackages(nil, []string{"b", "a"}, nil)
	cur = MergeExtraPackages(cur, []string{"c"}, nil)
	if strings.Join(cur, " ") != "a b c" {
		t.Errorf("merge %v", cur)
	}
	if got := MergeExtraPackages(cur, nil, []string{"b"}); strings.Join(got, " ") != "a c" {
		t.Errorf("drop %v", got)
	}
}

func TestImageKeyCoversLayersAndExtras(t *testing.T) {
	a := ImageKey("sha256:x", []string{"kvm", "llvm"}, []string{"b", "a"})
	if a != ImageKey("sha256:x", []string{"llvm", "kvm"}, []string{"a", "b"}) {
		t.Error("order changes the key")
	}
	for name, k := range map[string]string{
		"base":   ImageKey("sha256:y", []string{"kvm", "llvm"}, []string{"a", "b"}),
		"layer":  ImageKey("sha256:x", []string{"kvm"}, []string{"a", "b"}),
		"extras": ImageKey("sha256:x", []string{"kvm", "llvm"}, []string{"a"}),
	} {
		if k == a {
			t.Errorf("%s does not change the key", name)
		}
	}
}
