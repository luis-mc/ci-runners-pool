# CRSP91 report: agent recovery (operations R5.44, web-console R5.33)

Status: code done.

## Design
- Frozen recovery call: `POST /recovery/v1/poll` on the agent link port (plain JSON, no protobuf; never changes shape). Auth: machine key and machine id, as the link.
- The controller answers with a signed update target (version, asset, SHA-256, validity window), signed with the controller's pinned TLS key. The agent checks the chain against its pin, then the signature, then downloads with the existing update checks (SHA-256, attestation).
- Protocol gate: a Session whose Hello says a protocol older than the minimum is refused (`FailedPrecondition`), and the machine is marked `needs_recovery` (reason `old_protocol`). A machine asked to update for over an hour that still runs the old version is marked the same (reason `stuck`).
- Owner action: `POST /api/v1/machines/{id}/recovery` arms the push. Only an armed machine is served the target.
- Console UI (R5.33): NOT done here (packages/ui, apps/web are off limits). API exposes `recovery` on the machine; left for a UI task.

## Done
- `internal/tlsca/sign.go`: sign with the server key, verify against the pin.
- `internal/recovery`: frozen JSON call, handler (controller), client and `CheckAnswer` (agent).
- `internal/machines`: `Options.MinProtocol` refusal, `recovery.go` (state, arm, served), `View.Recovery`, recovery path mounted on the link server.
- API: `recovery` on Machine, `POST /api/v1/machines/{machineId}/recovery` (admin); openapi, Go and TS codegen regenerated.
- Agent: `Config.Recoverer`, `ErrNeedsRecovery`; wiring in `cmd/crsp` (min protocol 2, release target from SHA256SUMS, update manager as installer).
- Docs: operations R5.44 built (text), web-console R5.33 notes the API part; change notes `CRSP91.md` in operations and web-console.

## Left / notes
- Console card (web-console R5.33): UI task, packages/ui and apps/web untouched.
- `crsp agent reinstall` and the one-time token: not built. An agent from before this change has no recovery call; it still needs the install command again.
- Behaviour change: the controller now refuses Sessions from agents with protocol 1 (before HND15). They show `needs recovery`.
- The recovery installer uses the update manager's own checks (SHA-256 of SHA256SUMS and attestation); the signed SHA-256 authorises the push and is checked against the signature, not re-used by the manager.
- Checks run: gofmt, `go vet` for linux and windows on touched packages, `GOOS=darwin go vet` on touched packages (whole-repo darwin vet fails in the systray dependency in this sandbox), `go test -race` of recovery, tlsca, machines, agent, api, cmd/crsp. golangci-lint could not run (sandbox build is older than the target Go). `.githooks` are not executable here, so they did not run; no `--no-verify` used. docs_check and docs_fold scripts are not in this sandbox; the change notes were written by hand.
