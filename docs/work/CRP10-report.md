# CRP10 report: feature spec `notifications`

Branch: `CRP10-spec-notifications` (from `main` at 5bedb33). No pull request (by brief).

## Status

- [x] Branch made, inputs read (product brief, decisions 0001-0005, stack profile, design system v1 UX rules and content, DOCSPEC section 4, feature-spec template).
- [x] `docs/features/notifications/spec.md` written: 41 requirements (R5.1-R5.32, R6.1-R6.9), each with a planned test in section 9. Status `proposed`, everything NOT YET IMPLEMENTED.
- [x] `docs_index.py build` run; generated files committed.
- [x] `docs_check.py`: 0 warnings. One error left by design: W1 for this report under `docs/work/` (the join strips it with `docs_work.py strip`).
- [x] Committed and pushed. SPEC DONE.

## Notes

- Planned tests do not exist yet. The section 9 table names them in plain text (no backticks), so `docs_check.py` S2 does not fail on paths that are planned. Section 12 has no `Source:` lines for the same reason.
- Front matter: apps controller, web-console, tray, cli; topics observability, operations, ui, security; code globs `internal/notify/**`, `internal/mail/**`.

## Open owner questions (spec section 10)

1. Raw SMTP: allow as a recorded STACKSPEC 8.1 deviation (stack profile section 15), or provider APIs with bounce feedback only?
2. Webhooks to plain `http://` on private addresses, with a warning?
3. `job.waiting` threshold: pool-wide only, or per repository too?
4. Add "Send test" to design system `next-version` content.md (no "Send" word in v1)?
5. Is Send test on a Settings card allowed under UX-52 (Settings hold configuration only)?
6. Tray on a machine that is not the controller: which user, and how it signs in (tray spec)?
7. Which mail providers the adapter supports first.
