# CRSP87 report: LAN caches (caches R5.50)

Branch CRSP87-lan-caches. Status: CODE DONE.

Built: `internal/lancache` (store, server with Twirp JSON receiver, LAN-only TLS listener, client with fallback). Tests: hit/miss, digest mismatch, changed blob, eviction at cap, unknown machine, fallback when down, repository scoping, Twirp round trip, listen refusal. `go test -race`, `go vet` for linux/windows/darwin pass.

Not done / not checked:
- golangci-lint: binary built with go1.25, repo targets 1.27.4, cannot load config here.
- docs_check.py: luismc-docs plugin not present in this sandbox.
- Real `@actions/cache` contract test (e2e) not run: no e2e allowed. Put Block/Put Block List and protobuf for step 3 not built.
- Package proxy stores what a peer sends; no npm/PyPI/crates/apt wire format.
- Not wired into settings, agent or doctor.
