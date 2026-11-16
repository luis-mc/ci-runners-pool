---
change: minor
task: CRSP123
---
`crsp agent install` takes `--yes`: it answers the install plan without a typed yes, for an install that runs over SSH where nobody can type (machines R5.3a). Without it the plan still asks.
