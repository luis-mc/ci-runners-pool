---
change: minor
task: HND20
---
The symbolic link right of a Windows runner's account is set through the `RightsGranter` interface (with a fake for tests), granted at runner creation only when the setting asks, and read together with Developer Mode, which is never turned on (R5.68, R5.14); open question 28 is closed.
