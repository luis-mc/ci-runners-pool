---
change: minor
task: REG8
---
Image scan (R5.59 to R5.62): internal/registry/scan queues a scan row per promotion, runs pinned Syft and Trivy by digest on a machine, keeps counts by severity in registry_scans and stores the SBOM and the report as OCI referrers of the image. A failed scan is recorded and never blocks a pull or a promotion. Tools come through sha256-checked pins from scripts/delivery/tools.json; the Trivy pin is still to add.
