# CRP12 report: web-console feature spec

Status: done. SPEC DONE.

## Steps

- [x] Branch `CRP12-spec-web-console` from `main` (5bedb33).
- [x] Read product brief, decisions 0001-0005, design system v1, contract, apps/web/src, template and DOCSPEC section 4.
- [x] Wrote `docs/features/web-console/spec.md` (status proposed, NOT YET IMPLEMENTED throughout).
- [x] Regenerated docs index (`docs_index.py build`, dev-standards scripts 2.6.1).
- [x] `docs_check.py`: 0 warnings (no U1); 1 error W1 for this report under docs/work/ (expected on an agent branch; the join strips it).
- [x] Committed and pushed. No PR opened.

## Result

- 45 requirements: R5.1 to R5.32 (functional), R6.1 to R6.13 (non-functional). Each has a planned test in section 9 (Vitest, Playwright e2e, design kit guards, Go tests). Planned paths sit in the third column so S2 does not flag files that do not exist yet.
- Nine screens plus the shell, each with purpose, API operations (to add to openapi.yaml), states, actions and confirmations, components, and milestone. M1: sign-in and first run, overview, repositories, machines, runners basic, settings users (and appearance, for UX-60).
- Feature behaviour is referenced by folder name only (github-integration, machines, runners, scheduling, caches, doctor, observability, notifications, operations).

## Open owner questions (spec section 10)

Design system next version (no new rules written in the spec):

- Q1 command palette and shortcut list components (UX-57 names them, no component).
- Q2 copyable command block and the word "Copy".
- Q3 a rule for a session that ends mid-work.
- Q4 a meter (level bar with a limit) for memory, CPU, slots.
- Q5 action words: Sign in with GitHub, Sign out, Drain, Resume, Turn on, Turn off, Rebuild, Wipe, Export, Copy.
- Q6 one-time secret shown once with a time limit (join code).
- Q7 narrow form of the top menu (component 2) at 360 px.
- Q8 UX-52 (settings = configuration only) vs audit log and config export under Settings.
- Q9 picker Source paths in components 35-37 point at apps/web/src/ui/pickers, files are in packages/ui/src/pickers.

Product:

- Q10 first run as three wizards in a checklist (WC-D2).
- Q11 one-time setup link guards first run (WC-D1).
- Q12 session idle and total lifetimes.
- Q13 join code in milestone 1 (brief lists it under milestone 3).
- Q14 performance budgets of R6.12.
- Q15 browser trust for the controller's own TLS certificate.
- Q16 variable names: decision 0002 says CI_RUNS_ON*, brief says CRP_RUNS_ON_*.
- Q17 GitHub App callback URL vs other host names or IPs.
