package runners

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
)

// Pin is one pinned GitHub runner download (runners R5.37).
type Pin struct {
	OS      string
	Arch    string
	Version string
	SHA256  string
}

// ErrBadHash is returned when a pin hash is not a real SHA-256.
var ErrBadHash = errors.New("runner hash is not a valid SHA-256")

// ErrHashMismatch is returned when a download does not match its pin.
var ErrHashMismatch = errors.New("runner download hash does not match the pinned hash")

// ValidSHA256 is false for a value that is not 64 hex characters or is one
// repeated character (port of dev-standards DS R5.14).
func ValidSHA256(h string) bool {
	if len(h) != 64 {
		return false
	}
	if _, err := hex.DecodeString(h); err != nil {
		return false
	}
	return strings.Count(h, string(h[0])) != len(h)
}

// pins is the version table carried in the binary. Each hash is the SHA-256 of
// the official actions/runner v2.330.0 release asset, computed by CRSP22 from
// the download; the owner compares them with the release notes at review.
//
// The value of a hash is checked by ValidSHA256 before every use; an entry that
// fails is refused, so an unfilled pin never downloads anything.
var pins = []Pin{
	{OS: "linux", Arch: "x64", Version: "2.330.0", SHA256: "af5c33fa94f3cc33b8e97937939136a6b04197e6dadfcfb3b6e33ae1bf41e79a"},
	{OS: "linux", Arch: "arm64", Version: "2.330.0", SHA256: "9cb43527912086c7c8fb4119cb06409fcbcbd6f93a2d8507f30b07c495620f5c"},
	{OS: "windows", Arch: "x64", Version: "2.330.0", SHA256: "a7469e7f2949657327fdd75688fd8858e1352202847d024d68b93de033990779"},
	{OS: "windows", Arch: "arm64", Version: "2.330.0", SHA256: "d6b713c83263e2498931488079a3a20770d4a205a47fac51da86026e45754596"},
	{OS: "macos", Arch: "x64", Version: "2.330.0", SHA256: "40a32b7b87e25b76b595e201e0af376fcb1c3b7838fe21452909756090473ea9"},
	{OS: "macos", Arch: "arm64", Version: "2.330.0", SHA256: "e7515e45f6de15e37e6f1667bb2f962fb535a86689af1f9b219860300d06de1b"},
}

// PinFor returns the pin for an OS and architecture.
func PinFor(os, arch string) (Pin, error) {
	for _, p := range pins {
		if p.OS == os && p.Arch == arch {
			if !ValidSHA256(p.SHA256) {
				return Pin{}, fmt.Errorf("%s/%s: %w", os, arch, ErrBadHash)
			}
			return p, nil
		}
	}
	return Pin{}, fmt.Errorf("no pinned runner for %s/%s", os, arch)
}

// DownloadURL is the release asset for a pin.
func (p Pin) DownloadURL() string {
	ext := "tar.gz"
	osName := p.OS
	if p.OS == "windows" {
		ext = "zip"
		osName = "win"
	}
	if p.OS == "macos" {
		osName = "osx"
	}
	return fmt.Sprintf("https://github.com/actions/runner/releases/download/v%s/actions-runner-%s-%s-%s.%s",
		p.Version, osName, p.Arch, p.Version, ext)
}

// VerifyFile checks the file against want. A file that does not match is
// deleted and refused (runners R5.37, section 8).
func VerifyFile(path, want string) error {
	if !ValidSHA256(want) {
		_ = os.Remove(path)
		return ErrBadHash
	}
	f, err := os.Open(path) //nolint:gosec // path is the agent's own download.
	if err != nil {
		return err
	}
	h := sha256.New()
	_, copyErr := io.Copy(h, f)
	_ = f.Close()
	if copyErr != nil {
		return copyErr
	}
	if !strings.EqualFold(hex.EncodeToString(h.Sum(nil)), want) {
		_ = os.Remove(path)
		return ErrHashMismatch
	}
	return nil
}
