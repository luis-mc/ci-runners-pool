---
change: minor
task: OPS35
---
No address is written into code. CRSP_GITHUB_URL, CRSP_GITHUB_API_URL and CRSP_RUNNER_DOWNLOAD_URL are read and checked at start in one file (internal/addresses); GitHub Enterprise Server hosts work, and a guard fails on a literal address in Go or web code (R5.94, R5.95).
