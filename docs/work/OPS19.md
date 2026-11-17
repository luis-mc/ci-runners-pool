# OPS19 + LOOK20 report

Branch `OPS19-runner-delete-and-wizard`.

## OPS19 (runner delete)
- Cause 1, list never moved: nothing published `runner.state`, so the console never re-read the list; the draining row stayed until a manual reload. Fix: `runners.NotifyStore` wraps the store and tells every record change (made, state, service, registration, removed); wired in `cmd/crsp/areas_wiring.go`, payload from `api.RunnerEventJSON`. The web list also re-reads every 3 s while a runner is draining or removing.
- Cause 2, false "Problem: no such runner or plan": I could not reproduce a server-side miss by id (list and lookup share the id key). The window is a runner removed between list and delete; the web counted the 404 as a problem. Fix: web ignores `not_found` on delete (already gone = done). Lookup also hardened: `Service.find` takes the id, or the name when exactly one runner has it (BeginRemove, GetView, PlanReplacement, DeleteOfflineRegistration).
- Tests: `internal/runners/lookup_test.go` (light runner by id and name, ambiguous name, NotifyStore), `Runners.test.tsx` (no problem line; draining row leaves live on `runner.state`; 404 on delete is not shown).

## LOOK20 (wizard loading)
- Shared `Wizard` doc: loading is a state of the current step. Four wizards drew `Reading ...` as numbered step 1 (Add runners, Turn on the pool, Connect GitHub, Update); the step lists now start at the first real step (`firstStep={0}`). Add machine and Pool size had no such step.
- Harness: new rule `loading-is-a-step` in `scripts/design/wizard-behaviour.ts` (no checked step, first step current, no "Reading" step while loading), with self-tests. All ten states still required; known table stays empty.
- Docs: next-version UX-30, components 4, content, CHANGES C87; web-console and runners specs; change notes.

## Checks run
go test ./internal/... ./cmd/..., golangci-lint (go1.27.4 build) 0 issues, vitest web + ui + scripts/design, tsc web and ui, eslint touched.
Two web tests fail with or without this change (ConfigExport and audit export `Blob.text` under Node 22; repo wants Node 24).

## Notes
- `docs_fold.py` and `docs_check.py` (luismc-docs plugin) are not in this sandbox: change notes were written by hand in the existing format; run `docs_check.py` before merge.
- `pnpm install` ran the repo's `prepare` script, which sets `core.hooksPath .githooks` (the repo's own hooks). I did not set it by hand.
