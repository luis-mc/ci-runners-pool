//go:build linux

package registry

import (
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/linux"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

func platform(d sys.Deps) []backend.Backend {
	return []backend.Backend{linux.New(d, linux.DefaultConfig())}
}
