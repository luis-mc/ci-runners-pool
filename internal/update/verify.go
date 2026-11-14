package update

import (
	"bufio"
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"
)

// Failure names which check refused a build (operations R5.12).
type Failure struct {
	Check  string // "checksum" or "provenance"
	Reason string
}

func (f *Failure) Error() string { return "the " + f.Check + " check failed: " + f.Reason }

// SumFor finds the SHA-256 of asset in the text of a SHA256SUMS file
// ("<hex>  <name>" per line, as sha256sum prints it).
func SumFor(sums []byte, asset string) (string, bool) {
	sc := bufio.NewScanner(bytes.NewReader(sums))
	for sc.Scan() {
		f := strings.Fields(sc.Text())
		if len(f) == 2 && strings.TrimPrefix(f[1], "*") == asset && len(f[0]) == 64 {
			if _, err := hex.DecodeString(f[0]); err == nil {
				return strings.ToLower(f[0]), true
			}
		}
	}
	return "", false
}

// FileSHA256 hashes a file.
func FileSHA256(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer func() { _ = f.Close() }()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// Attester checks the build provenance attestation of a downloaded file: it
// must be valid and name this repository's release workflow (R5.12).
type Attester interface {
	Verify(ctx context.Context, file string) error
}

// GHAttester checks the attestation with `gh attestation verify`, which
// verifies the Sigstore bundle of the file against GitHub's trust root and the
// signer workflow. Without gh on the machine it fails closed (R6.3).
type GHAttester struct {
	// Run runs a command and returns its combined output; nil uses os/exec.
	Run func(ctx context.Context, name string, args ...string) ([]byte, error)
	// LookPath finds gh; nil uses exec.LookPath.
	LookPath func(string) (string, error)
}

// SignerWorkflow is the workflow the attestation must name.
const SignerWorkflow = Repo + "/.github/workflows/release.yml"

// Verify implements Attester.
func (g GHAttester) Verify(ctx context.Context, file string) error {
	look := g.LookPath
	if look == nil {
		look = exec.LookPath
	}
	gh, err := look("gh")
	if err != nil {
		return &Failure{Check: "provenance", Reason: "the GitHub CLI (gh) is not installed here, so the build provenance cannot be checked. Install gh, or update by hand."}
	}
	run := g.Run
	if run == nil {
		run = func(ctx context.Context, name string, args ...string) ([]byte, error) {
			return exec.CommandContext(ctx, name, args...).CombinedOutput()
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	out, err := run(ctx, gh, "attestation", "verify", file, "--repo", Repo, "--signer-workflow", SignerWorkflow)
	if err != nil {
		msg := strings.TrimSpace(string(out))
		if len(msg) > 300 {
			msg = msg[:300]
		}
		if msg == "" {
			msg = err.Error()
		}
		return &Failure{Check: "provenance", Reason: msg}
	}
	return nil
}

// Verify refuses a download unless its SHA-256 matches SHA256SUMS and its
// attestation is valid. Both must pass; any failure keeps the running build.
func Verify(ctx context.Context, file, asset string, sums []byte, at Attester) error {
	want, ok := SumFor(sums, asset)
	if !ok {
		return &Failure{Check: "checksum", Reason: asset + " is not listed in SHA256SUMS"}
	}
	got, err := FileSHA256(file)
	if err != nil {
		return fmt.Errorf("read the download: %w", err)
	}
	if got != want {
		return &Failure{Check: "checksum", Reason: "the download does not match SHA256SUMS"}
	}
	if at == nil {
		return &Failure{Check: "provenance", Reason: "no provenance check is configured"}
	}
	if err := at.Verify(ctx, file); err != nil {
		var f *Failure
		if errors.As(err, &f) {
			return err
		}
		return &Failure{Check: "provenance", Reason: err.Error()}
	}
	return nil
}
