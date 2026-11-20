---
change: minor
task: REG10
---
New feature spec for the pool's private image registry (owner decisions of 19 Nov 2026) and its shared contract: the image key (12 hex of sha256 over canonical JSON of profile, stack hash, arch, base digest, pins and toolchains) with three vectors (R5.21, R5.22), the Go types and interfaces of internal/registry, migration 00019 with one query file per owning task, the protocol version 3 agent link calls (R5.20) and the /api/v1/registry operations, which answer 501 until their task builds them.
