---
change: minor
task: CRSP106
---
No change in the commands. The controller and the agent now log through a redacting handler (`internal/logging`), so a token, a PEM block or a secret value read from the secret store never reaches a log line; see github-integration R6.1 and R6.3.
