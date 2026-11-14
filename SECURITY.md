# Security policy

## Supported versions

We support the latest stable release.
We also support the `edge` pre-release.
Older releases get no fixes. Please upgrade.

## How to report a vulnerability

Use GitHub private vulnerability reporting.
Open the repository's Security tab, then choose Report a vulnerability.
Do not open a public issue for a security problem.
Do not post details in public discussions or pull requests.

## What to expect

We acknowledge critical and high reports within 2 days.
We triage every report as set out in `docs/architecture/stack-profile.md`.
Critical and high issues are handled within 2 days; others within 7 days.
We will tell you when a fix ships.

## Scope notes

Secrets are never stored in the database or written to logs.
This covers GitHub App keys, webhook secrets and tokens.
If you see a secret in either place, report it as a vulnerability.
All product data stays on the operator's own machines.
