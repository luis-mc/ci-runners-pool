---
change: patch
task: CRSP33
---
R5.13: the session cookie is Secure on every address, loopback too, because the console is served over HTTPS only (web-console R5.1, R6.1). Callback URLs on a loopback address (R5.4) are not changed here: the controller now answers HTTPS on 127.0.0.1:8460, so the http loopback callback of the dev App needs the owner's decision.
