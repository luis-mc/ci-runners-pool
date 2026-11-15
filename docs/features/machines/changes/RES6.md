---
change: minor
task: RES6
---
A setting the user made never reverts by itself. The machine record is written under one lock, so a heartbeat or a facts report that read the record before a rename or a drain no longer writes the old name or state back. A settings change that waits for a drain (allowed backends) now carries only the fields it changes: a budget, drain timeout, mode, CPU cap or cache cap the user changed while it waited stays. A heartbeat dated more than 30 seconds ahead of the controller clock (R5.35) is not fresh: the machine goes offline and `machine.heartbeat.skew` is written to the audit log (RES13). New regression tests are in the test table (R5.22, R5.24, R5.30, R5.35).
