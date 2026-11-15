//go:build linux

package registry

import (
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/container"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/linux"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/sys"
)

// platform lists the container backend before the persistent one (decision
// 0003, runners R5.31). The container backend is built in but a machine uses
// it only when its allow list names it; the allow list is off by default
// (machines R5.9).
func platform(d sys.Deps) []backend.Backend {
	eng := &container.Docker{Cmd: d.Cmd, GOOS: "linux"}
	return []backend.Backend{
		container.New(d, eng, container.DefaultConfig()),
		linux.New(d, linux.DefaultConfig()),
	}
}
