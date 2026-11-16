---
change: minor
task: CRSP131
---
crsp offers private repositories by default: the setting Public repositories (off until the owner turns it on; `GET`/`PUT /api/v1/settings/public-repositories`, `crsp settings public-repositories [--on|--off]`, audited both ways) decides whether a public repository can be served (R5.54). While it is off, turning the pool on or adding runners for a public repository is refused with 409 `public_repositories_off`; switching it off stops the pool of every public repository on it, keeps its policy, returns the hosted labels and removes the runners, and says how many (R5.55). A public repository that stays on the pool keeps working and carries the problem `public_pool_on_while_off`; the `publicized` webhook and the 10-minute check no longer stop it (R5.41, R5.47, R5.56, R5.57). Visibility is stored on every sync (R5.58).
