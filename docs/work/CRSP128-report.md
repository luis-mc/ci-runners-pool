# CRSP128 report: runner records pile-up, state truth, machine name, failed reason

Branch: CRSP128-runner-records (from main 68d30b3).

## Plan
1. Light loop (`internal/runners/light.go`): one record per repo and OS; a failed one is retried in place after a backoff (cap 5, reason shown); leftovers (GitHub registration, service, record) cleaned before a new attempt; names unique over records and services.
2. State truth (UX-19): `View` built from record + GitHub runner list + agent service list. States `not_registered`, `stopped`, `unknown` added to the API enum. Idle only when GitHub online, not busy, service running.
3. API `Runner` gets `machine_name` and `reason`.
4. Web Runners table: machine name links to the machine page; failed rows show reason and a Remove button.
5. Docs: runners, web-console change notes; design-system next-version content + CHANGES.

## Status
- [x] light loop
- [x] state truth
- [x] API
- [x] web
- [x] docs

## Notes
- `docs_fold.py` / `docs_check.py` (luismc-docs plugin) are not in the sandbox; change notes written by hand in `docs/features/{runners,web-console}/changes/CRSP128.md` with the same front matter. Run docs_check before merge.
- Scheduling: no change note; scheduling R5.65 behaviour is described in runners R5.57.
- Runner store is `MemStore` in production, so retry counters live in the service (lost on restart; a restart gives a failed light runner a fresh try).
- Service state needs the agent service list; only the controller's own machine answers (`linkAgent.Services`), others do not claim `stopped`.
- Not done here: CRSP126 service start failure; `state` list filter still matches stored states.
- `GOOS=darwin go vet ./cmd/crsp` fails on the systray cgo dependency (not from this change); runners and api vet clean on windows and darwin.
