---
change: patch
task: CRSP41
---
The controller now passes the GitHub area, the runners service and the doctor to the API, so their operations no longer answer 501 in the real binary. A wiring test and the packaged smoke (getSetupState) keep it so. Records are in memory until the SQL store lands. Contract unchanged.
