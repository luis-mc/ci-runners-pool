---
change: minor
task: CIX7
---
R5.38 reworded (owner decision D4, 20 Nov 2026): CI run insights may store CI job logs, test reports and datasets built from them on the owner's machines, redacted with internal/redact, with a retention limit and a size cap per repository set in Settings, Data. Still never stored: secrets, environment values, actor email. R6.7 unchanged; R6.8 gains the CI data rows.
