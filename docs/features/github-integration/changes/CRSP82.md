---
change: minor
task: CRSP82
---
A served repository that turns public is stopped at once: the `repository` webhook (`publicized`) or the 10-minute visibility check turns its pool off, sets `RUNS_ON_*` to hosted, removes its runners and logs why (R5.47). A webhook job is partial until the poller reads its run, so a forked pull request never gets a runner by guesswork (R5.48). The App now subscribes to `repository`.
