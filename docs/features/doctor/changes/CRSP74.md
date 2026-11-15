---
change: minor
task: CRSP74
---
New checks `repo.waiting` (info: jobs wait because no machine is up and the fallback is off) and `repo.fallback` (warn while a repository runs on GitHub-hosted runners); `repo.vars` and `repo.vars.runner` accept the hosted label while the fallback holds (R5.37, R5.38). 28 checks.
