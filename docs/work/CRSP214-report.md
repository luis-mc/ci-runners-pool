# CRSP214 report: web and e2e test guardrails

Branch `CRSP214-web-e2e-test-guardrails-2`, from `origin/CRSP208-release-48`.

## Done
- vitest `testTimeout`/`hookTimeout` 10 s in the root `guard` and `design` projects, `apps/web` and `packages/ui` (slowest guard test 0.4 s).
- bundle-size test 5 s (measured 0.5 s); wizards harness cases 5 s (slowest 0.7 s).
- Web sleeps removed: Jobs.test.tsx, pool.test.tsx, PullingStep.test.tsx now wait on the requests answered, then flush state with `act`.
- e2e: `ux-routes.spec.ts` layout case is one test per route and mode, short-window case one per url, mode and width; each waits for the h1. `waitForTimeout` in ux-routes, ux-table-cells and ux-guards replaced by two animation frames (`frames`). Every measure kept.
- `test_guardrails.py`: G1 8 -> 3, G4 23 -> 18. No entry added.

## Status
- Web suites touched: pass. Guardrails, prettier, eslint, tsc: clean.
- E2E gate (DL-88), 20.4 min: 3211 passed, 2 skipped, 3 failed:
  `ux wordBroken: /jobs/insights` (data, stress, empty): "Guardrails" broken over lines at 1300 px.
- Proof it is not this change: the same 3 fail with the unchanged `ux-guards.ts` and `ux-routes.spec.ts` of the release head (`git checkout HEAD~1 -- ...`, 18 passed, same 3 failed). Left as is; no check weakened. Owner: the Insights Guardrails screen (RELEASE-48).
