---
change: minor
task: CRSP121
---
`getSetupState` computes `first_machine` as done when at least one machine has joined, in any state, and `first_repository` as done when at least one repository has its pool on, read from the store alone. A failed read is logged, not swallowed.
