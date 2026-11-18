package main

import (
	"context"

	"github.com/luis-mc/ci-runners-shared-pool/internal/agent"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend"
	"github.com/luis-mc/ci-runners-shared-pool/internal/backend/registry"
)

// agentCacheSource lets an agent find its runners' cache folders from the OS
// service list (caches R5.36, runners R5.5). The agent measures and wipes; it
// takes no path from the controller.
func agentCacheSource() agent.CacheSource {
	reg := registry.Platform(realDeps(func(string, string) {}, secretRedactor.Redact, secretRedactor.Add))
	return agent.FoundRunners{Find: func(ctx context.Context) ([]agent.CacheRunner, error) {
		b, ok := reg.Get(backend.Persistent)
		if !ok {
			return nil, nil
		}
		f, ok := b.(backend.Finder)
		if !ok {
			return nil, nil
		}
		found, err := f.Find(ctx)
		if err != nil {
			return nil, err
		}
		out := make([]agent.CacheRunner, 0, len(found))
		for _, r := range found {
			if r.Managed && r.Folder != "" {
				out = append(out, agent.CacheRunner{Name: r.Name, Service: r.ServiceName, Folder: r.Folder})
			}
		}
		return out, nil
	}}
}
