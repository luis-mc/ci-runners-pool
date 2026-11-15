---
title: Speed comparison workflow
type: guide
---
# Speed comparison workflow

Optional. Run one job once on crsp and once on a GitHub-hosted runner, so `crsp compare` has a fair pair of runs on the same commit (observability R5.34).

Nothing here starts by itself. The workflow runs only when you press "Run workflow", and it spends hosted minutes (private repositories are billed), so run it when you mean to.

## The workflow

Copy to `.github/workflows/speed-ab.yml` in the repository. Replace the `RUNS_ON` value of the crsp leg with the label your repository uses for the pool, and replace the steps with the job you want to measure.

```yaml
name: speed-ab
on:
  workflow_dispatch:

jobs:
  # Both legs share one job name, so crsp compare matches them.
  measured-crsp:
    name: measured
    runs-on: [self-hosted, linux, crsp]
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build.sh   # the job to measure

  measured-hosted:
    name: measured
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: ./scripts/build.sh   # the same job
```

Why the two legs do not depend on each other: they start together, so both measure the same commit and neither waits for the other. The job `name` is the same on both, which is how `crsp compare` pairs them.

## Read the result

```
crsp compare owner/repo --days 1
```

The row named `measured` shows queue wait and run time at the median and 95th percentile for each kind, the minutes saved and the hosted cost avoided. One run per kind gives one sample each; run the workflow a few times for a median worth trusting.

A public repository shows no cost: hosted minutes there are free.
