---
change: minor
task: OPS55
---
R5.73 to R5.75: runners for one repository on a machine never exceed its job slots; the slot wait is its own phase (slot_wait_ms, no new field); the job-started hold is cut to 10 minutes, a third of the 30-minute job timeout, and the default gate maximum wait is 10 (was 30). R5.1 and R5.20 updated.
