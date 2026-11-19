---
change: minor
task: OPS41
---
CI base image: the `image` job runs only on release pull requests, main and manual runs, or when `images/**` or the build or ci workflow changed; images build with buildx and the GitHub Actions cache; apt retries and times out; the base Dockerfile gets a `tools` stage that does not depend on the `crsp` binary (R5.49).
