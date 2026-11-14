---
change: patch
task: CRSP25
---
Contract: added operation createConsoleLink (POST /api/v1/auth/console-links) so the CLI can ask for a one-time console link (cli R5.9). The link code is redeemed by redeemTrayLink. The handler is a 501 stub until the web console task builds it.
