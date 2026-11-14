package registry

import (
	"runtime"
	"testing"

	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/linux"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/macos"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/windows"
)

// R5.8 and R5.24: every persistent backend implements the interface, and the
// registry of a binary holds only the backend of its OS.
func TestEveryBackendImplementsInterface(t *testing.T) {
	d := sys.Deps{}
	for name, b := range map[string]backend.Backend{
		"windows": windows.New(d, windows.Config{}),
		"linux":   linux.New(d, linux.Config{}),
		"macos":   macos.New(d, macos.Config{}),
	} {
		if b.Name() != backend.Persistent {
			t.Errorf("%s: name %s", name, b.Name())
		}
		var _ backend.Finder = b.(backend.Finder)
		var _ backend.Deregisterer = b.(backend.Deregisterer)
	}
}

func TestRegistryHoldsOnlyThisOS(t *testing.T) {
	reg := Platform(sys.Deps{})
	want := map[string]bool{"windows": true, "linux": true, "darwin": true}[runtime.GOOS]
	if got := len(reg.All()) == 1; got != want {
		t.Fatalf("GOOS=%s: %d backends", runtime.GOOS, len(reg.All()))
	}
	if want {
		if _, ok := reg.Get(backend.Persistent); !ok {
			t.Fatal("no persistent backend")
		}
	}
}
