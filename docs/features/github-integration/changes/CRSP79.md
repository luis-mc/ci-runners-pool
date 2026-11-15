---
change: minor
task: CRSP79
---
Builds R5.35 and R5.40: crsp's own client of the runner scale-set protocol as a demand source behind the setting `scaleset_demand` (off by default), with an automatic fallback to polling and a back-off retry. The JIT config now reaches the runner on standard input only: the tmpfs file of runners R5.25 is gone. A job from a scale set takes its runner's JIT config from the scale set. A pull request from a scale set counts as a fork pull request, because the message does not say.
