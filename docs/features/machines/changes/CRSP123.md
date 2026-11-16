---
change: minor
task: CRSP123
---
The optional SSH join now also works for Windows machines that run the OpenSSH server (owner decision D70). The controller reads the default shell (cmd or PowerShell), refuses a user who is not an administrator (`net session`), downloads the controller's own installer with a SHA-256 check when `crsp.exe` is missing (a `PackageSource`, so CRSP122's package endpoint can replace the release asset), and runs `agent install ... --yes`. `crsp agent install` gets a non-interactive `--yes`. The key is never stored (R5.3a).
