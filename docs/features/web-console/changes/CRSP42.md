---
change: minor
task: CRSP42
---
The console is served as plain HTTP on 127.0.0.1 and ::1 and as HTTPS only (TLS 1.3, the controller CA's certificate) on every other address (R5.1, D38). The session cookie is Secure on every address except loopback (R6.1); the headers, CSRF, Origin and role checks stay on both. Sessions never expire by time (D39): Q12 is answered and replaced by the decision, with a test for no idle expiry and survival of a controller restart. R6.12 is decided (D40: 2 s, 300 KB, 2 s) and Q14 is answered.
