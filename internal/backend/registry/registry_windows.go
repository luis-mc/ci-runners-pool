//go:build windows

package registry

import (
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/windows"
)

func platform(d sys.Deps, _ backend.IDSource) []backend.Backend {
	return []backend.Backend{windows.New(d, windows.DefaultConfig())}
}
