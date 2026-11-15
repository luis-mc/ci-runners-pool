---
change: minor
task: RES5
---
Private registry logins per backend kind (R5.77) and a private CA bundle runners trust (R5.78): container mounts a CA folder and runs `update-ca-certificates`, a VM gets the files at boot, a persistent runner gets environment lines only and the host trust store is never touched. Passwords are encrypted in the secret store and reach engines only on standard input. Registry routes added; backend start wiring is open.
