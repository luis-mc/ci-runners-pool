---
change: minor
task: LOOK31
---
A runner plan may name no scope (`planRunners`, `scope` optional). The service then takes the first repository with the pool on and adds the pool label to the runners; with no such repository it refuses with a reason. Until OPS23 gives every pool repository its own registration, a persistent runner still registers through that one repository.
