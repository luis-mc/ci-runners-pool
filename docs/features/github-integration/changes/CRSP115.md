---
change: minor
task: CRSP115
---
Key rotation built (R5.7): the owner replaces the App private key; the controller checks it with GET /app for the same App id before it replaces the old key, keeps the old key on any failure, and audits without the key.
