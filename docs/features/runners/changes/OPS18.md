---
change: minor
task: OPS18
---
Windows runner folder reset uses the account that was made (R5.58, R5.13): a runner named `crsp-…` no longer gets a doubled `crsp-crsp-` account name; `icacls /setowner` gets the account's SID (read after the account exists) and not its name, which fixes error 1332; a failed reset shows one short line, "Could not prepare the runner folder", with the step and reason in the log.
