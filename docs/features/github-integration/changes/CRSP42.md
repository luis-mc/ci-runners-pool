---
change: minor
task: CRSP42
---
R5.13 and R6.4 now agree with web-console R5.1 and R6.1: plain HTTP on 127.0.0.1 and ::1 only, the session cookie Secure on every other address, no time or idle expiry (D38, D39). R6.4 is built and mapped to its tests. The callback of a local controller stays http://127.0.0.1:<port>/auth/github/callback.
