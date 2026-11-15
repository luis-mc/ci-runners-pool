---
change: minor
task: CRSP74
---
Opt-in hosted fallback: the repository policy has `hosted_fallback`, `fallback_cap_minutes` and `hosted_labels` (off by default; turning it on needs a yes; public repositories are refused); the controller rewrites `RUNS_ON_<OS>` to the hosted label for opted-in repositories only, after the grace time (setting `fallback_grace_minutes`, default 3) with no machine up (online and accepting), and back as soon as one is; fallback minutes are counted per month with a cap; the repository view has `routing` (R5.40 to R5.44).
