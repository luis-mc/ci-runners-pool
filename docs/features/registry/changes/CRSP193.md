---
change: minor
task: CRSP193
---
The registry runs on a Windows controller: the storage driver closes a small file before it renames it (Distribution v3.1.2 renamed it while still open), and the registry folder setting is a full path of the system the controller runs on.
