---
change: minor
task: CRSP106
---
R6.1 and R6.3 are built. The controller and agent loggers redact GitHub token prefixes, PEM blocks, CLI tokens and every value read from or written to the secret store (`internal/logging`, `secrets.Learn`); a test feeds each kind through every log path. A schema test shows no database column can hold a secret.
