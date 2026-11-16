---
change: minor
task: CRSP139
---
A missing App permission is now one guided grant. The controller reads what the App asks for (`GET /app`) and what the installation accepted, answers one step list (install, ask, accept) with the live state of each and the exact missing permissions (`getGithubGrant`, R5.86), drops the cached installation token when new permissions are accepted, by a read or by the `new_permissions_accepted` webhook (R5.87), and the App manifest asks for `secrets: write` from the first run (R5.85). The parity setup answer carries the grant in place of the two page addresses (R5.84).
