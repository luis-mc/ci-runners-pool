//go:build !windows && !linux && !darwin

package registry

import (
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

func platform(sys.Deps, backend.IDSource) []backend.Backend { return nil }
