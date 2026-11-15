package runners

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"regexp"
	"sort"
	"strings"
)

// Layer is one image layer with a fixed tool list (runners R5.50). The names
// are the dev-standards names, so a project setting maps one to one.
type Layer struct {
	Name    string
	Release string // the parity release that adds it
	// Packages are the distribution packages the layer installs.
	Packages []string
	// Optional packages are installed when the base image has them; a missing
	// one is skipped without a failure.
	Optional []string
	// SelfCheck lists the commands the build runs; the layer fails when one fails.
	SelfCheck []string
	// Dockerfile is the layer's file, relative to the repository root.
	Dockerfile string
	// Rules are the other requirements the layer carries.
	Rules []string
}

// Layers returns the layers of R5.50 in image order. The playwright layer
// (R5.44) is not here: it is a later task.
func Layers() []Layer {
	return []Layer{
		{
			Name: "windows-packaging", Release: "v0.5.0",
			Packages:   []string{"dotnet-sdk-8.0", "wine", "wine64", "xvfb", "xauth", "msitools"},
			SelfCheck:  []string{"dotnet --version", "wine --version", "xvfb-run --help", "command -v xauth", "command -v msiinfo"},
			Dockerfile: "images/layers/windows-packaging/Dockerfile",
			Rules:      []string{"R5.42", "R5.52"},
		},
		{
			Name: "linux-packaging", Release: "v0.5.0",
			Packages: []string{"dpkg-dev", "rpm", "make", "checkpolicy", "selinux-policy-dev", "policycoreutils",
				"gnupg", "shellcheck", "systemd", "createrepo-c"},
			Optional:   []string{"policycoreutils-python-utils"},
			SelfCheck:  []string{"dpkg-deb --version", "rpmbuild --version", "make --version", "checkmodule -V", "gpg --version", "shellcheck --version", "createrepo_c --version"},
			Dockerfile: "images/layers/linux-packaging/Dockerfile",
		},
		{
			Name: "llvm", Release: "v0.5.0",
			SelfCheck:  []string{"clang-cl --version", "lld-link --version", "llvm-lib --help"},
			Dockerfile: "images/layers/llvm/Dockerfile",
			Rules:      []string{"R5.43"},
		},
		{
			Name: "kvm", Release: "v0.6.0",
			Packages:   []string{"qemu-system-x86", "qemu-utils", "cloud-image-utils", "openssh-client"},
			SelfCheck:  []string{"qemu-system-x86_64 --version", "qemu-img --version", "cloud-localds --help", "ssh -V"},
			Dockerfile: "images/layers/kvm/Dockerfile",
			Rules:      []string{"R5.41"},
		},
	}
}

// LayerByName finds a layer.
func LayerByName(name string) (Layer, bool) {
	for _, l := range Layers() {
		if l.Name == name {
			return l, true
		}
	}
	return Layer{}, false
}

var packageName = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9+.\-]*$`)

// PackageError names the line of a refused package list (runners R5.51).
type PackageError struct {
	Line int
	Name string
}

func (e *PackageError) Error() string {
	return fmt.Sprintf("line %d: %q is not a package name (letters, digits and + - . only, not starting with -)", e.Line, e.Name)
}

// ParseExtraPackages reads a pool's extra packages, one per line (runners
// R5.51). Blank lines and lines that start with # are skipped. Any bad name
// refuses the whole list with its line number, so nothing changes. The result
// is sorted without repeats.
func ParseExtraPackages(text string) ([]string, error) {
	seen := map[string]bool{}
	for i, raw := range strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n") {
		line := strings.TrimSpace(raw)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if !packageName.MatchString(line) {
			return nil, &PackageError{Line: i + 1, Name: line}
		}
		seen[line] = true
	}
	out := make([]string, 0, len(seen))
	for n := range seen {
		out = append(out, n)
	}
	sort.Strings(out)
	return out, nil
}

// MergeExtraPackages keeps a name that was added until the user drops it
// (R5.51): the new list is the old names plus the added ones, minus dropped.
func MergeExtraPackages(current, add, drop []string) []string {
	set := map[string]bool{}
	for _, n := range current {
		set[n] = true
	}
	for _, n := range add {
		set[n] = true
	}
	for _, n := range drop {
		delete(set, n)
	}
	out := make([]string, 0, len(set))
	for n := range set {
		out = append(out, n)
	}
	sort.Strings(out)
	return out
}

// ImageKey is the key of an image: the base digest, the layers that are on and
// the extra package names (R5.33, R5.51). The order of the inputs does not
// change it; any change of a layer set or a name does.
func ImageKey(baseDigest string, layers, extras []string) string {
	ls := append([]string(nil), layers...)
	es := append([]string(nil), extras...)
	sort.Strings(ls)
	sort.Strings(es)
	h := sha256.New()
	_, _ = fmt.Fprintf(h, "base=%s\nlayers=%s\nextras=%s\n", baseDigest, strings.Join(ls, ","), strings.Join(es, ","))
	return hex.EncodeToString(h.Sum(nil))[:16]
}
