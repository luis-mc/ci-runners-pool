//go:build darwin

package registry

import (
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/macos"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

func platform(d sys.Deps) []backend.Backend {
	return []backend.Backend{macos.New(d, macos.DefaultConfig())}
}
