# CRSP91 report: agent recovery (operations R5.44, web-console R5.33)

Status: in progress.

## Design
- Frozen recovery call: `POST /recovery/v1/poll` on the agent link port (plain JSON, no protobuf; never changes shape). Auth: machine key and machine id, as the link.
- The controller answers with a signed update target (version, asset, SHA-256, validity window), signed with the controller's pinned TLS key. The agent checks the chain against its pin, then the signature, then downloads with the existing update checks (SHA-256, attestation).
- Protocol gate: a Session whose Hello says a protocol older than the minimum is refused (`FailedPrecondition`), and the machine is marked `needs_recovery` (reason `old_protocol`). A machine asked to update for over an hour that still runs the old version is marked the same (reason `stuck`).
- Owner action: `POST /api/v1/machines/{id}/recovery` arms the push. Only an armed machine is served the target.
- Console UI (R5.33): NOT done here (packages/ui, apps/web are off limits). API exposes `recovery` on the machine; left for a UI task.

## Steps
(see git log)
