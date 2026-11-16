# CRSP128 report: runner records pile-up, state truth, machine name, failed reason

Branch: CRSP128-runner-records (from main 68d30b3).

## Plan
1. Light loop (`internal/runners/light.go`): one record per repo and OS; a failed one is retried in place after a backoff (cap 5, reason shown); leftovers (GitHub registration, service, record) cleaned before a new attempt; names unique over records and services.
2. State truth (UX-19): `View` built from record + GitHub runner list + agent service list. States `not_registered`, `stopped`, `unknown` added to the API enum. Idle only when GitHub online, not busy, service running.
3. API `Runner` gets `machine_name` and `reason`.
4. Web Runners table: machine name links to the machine page; failed rows show reason and a Remove button.
5. Docs: runners, web-console change notes; design-system next-version content + CHANGES.

## Status
- [ ] light loop
- [ ] state truth
- [ ] API
- [ ] web
- [ ] docs
