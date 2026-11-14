---
change: minor
task: CRSP19
---
Self-update built for the controller on Windows, macOS and Linux: setting auto_update (on by default), 6-hour check, stable releases only, SHA-256 and provenance checks, 60-minute drain then cancel, helper process per install kind (msi, pkg, deb, rpm, tarball), result and retry rules (R5.31 to R5.38). The provenance check runs inside crsp with sigstore-go and an embedded Sigstore trust root, with no gh on the machine (R5.34). The controller starts the Windows MSI itself, detached, and reads the log and the version after the restart (R5.35, R5.36); deb installs use `apt-get install -y ./<file>`. Agent-only machines follow the controller's version over the agent link with the same drain and retry rules (R5.39 to R5.41).
