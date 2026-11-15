---
change: minor
task: CRSP87
---
Shared caches on the LAN (R5.50): `internal/lancache` holds a content-addressed, digest-checked, size-capped store with least-recently-used eviction, served to pool machines only (machine id and credential of the agent link) on one private LAN address over TLS, with a Twirp JSON receiver for the Actions cache and a client that falls back to the normal path when the holder is down. The settings, agent wiring, doctor line and the real `@actions/cache` contract test are not built yet.
