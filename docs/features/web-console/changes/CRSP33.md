---
change: minor
task: CRSP33
---
Serve the console securely: HTTPS only with the controller CA's certificate (R5.1), the CSP and hardening headers on every answer (R6.3), the Secure session cookie (R6.1), the per-session CSRF token and the Origin check on every change (R6.2), the role check of x-auth on every operation with a closed default (R6.5), and a test that no response schema carries a secret (R6.4).
