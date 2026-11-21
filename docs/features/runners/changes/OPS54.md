---
change: minor
task: OPS54
---
Every runner login gets createrole_self_grant = 'set, inherit' (R5.97); a new login copies its sibling's attributes, settings and memberships (never SUPERUSER, REPLICATION, BYPASSRLS); leftover databases of a repository's logins go to the shared role; a test helper that creates databases must run as the shared role or use OWNER.
