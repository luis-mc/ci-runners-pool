---
change: minor
task: CRSP91
---
R5.44 is built: a machine needs recovery when its agent speaks a protocol below the minimum (normal calls refused) or stays old an hour after the update ask; the API shows `recovery` on the machine; one admin action arms a frozen JSON recovery call (`POST /recovery/v1/poll`) that hands the agent a target signed with the controller key, checked against the agent's pin, then installed with the usual SHA-256 and attestation checks. The console card and the `crsp agent reinstall` command are not built.
