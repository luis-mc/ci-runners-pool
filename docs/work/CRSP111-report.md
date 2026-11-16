# CRSP111 report

Task: github-integration R6.12 (sign-in, wizard /setup, repositories, users). Design system v1: UX-17.

## Audit result
- axe, dark and light, on /sign-in, /setup, /repositories, /settings/users: no serious or critical violation. No fix needed.
- No-app-CSS and raw-controls guards: green, known list empty.
- Design layout at 360/393/1300: repositories and users already covered; sign-in and wizard were not. Added.
- Focus order was not covered. Added a Tab-order test for the four screens.
- No app code changed, so packages/ui was not touched.

## Changes
- e2e/tests/design-layout.spec.ts: sign-in and first-run wizard screens.
- e2e/tests/web-console/a11y.spec.ts: focus-order test for the four screens.
- Spec R6.12 marked built; change note CRSP111.

## Not run
- docs_check.py: the luismc-docs plugin is not in this sandbox. Run it in CI or locally.
- Temporary Playwright config (Chromium under /opt/pw-browsers) was deleted before commit.
