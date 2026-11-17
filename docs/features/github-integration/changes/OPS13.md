---
change: minor
task: OPS13
---
The repository and installation list is read with the GitHub App's own key (`GET /app/installations`, `GET /installation/repositories`), so it needs no personal sign-in and survives a restart (R5.17, R5.18). The user's token only sets the admin flags when it is in memory; a failed App call shows its own reason, not `session_expired` (R5.89). The `session_expired` message on Repositories has the action "Sign in with GitHub again", which returns to the same screen.
