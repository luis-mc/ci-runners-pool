---
change: minor
task: CRSP70
---
The pool size has its console form: a Size, Review, Saving, Done wizard on the machine's page, backed by the dry run `POST /api/v1/machines/{id}/pool-size-check`. Review shows the budget check, the figures and the nearest size that fits; a lower size needs its own tick and sends `confirm_shrink` (R5.58, open questions M-10 and M-11).
