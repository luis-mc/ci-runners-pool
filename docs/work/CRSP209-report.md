# CRSP209 report: CI pipeline fixes and guardrails G1/G2

Branch CRSP209-ci-pipeline, base origin/CRSP196-integration (817a396).

## Checker before (test_guardrails.py, warn mode)
G1 12 breaks (5 vitest/web = not mine, 1 pytest, 6 go test without -timeout), G2 4 (ci.yml image, dev-standards checks, package-windows, train-cleanup), G7 pass.

## Items
(filled in as each step lands)
