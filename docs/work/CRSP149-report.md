# CRSP149 report

Branch CRSP149-core-rules, from origin/main (865788d is an ancestor).

- Release: dev-standards RELEASE-149, luismc-docs 2.7.0, commit 0b389c4529b37174ee58e6f30469f7efa9ac8912 (on main).
- ux-rules.md: CORE-1..7 section copied from the 2.7.0 template (same place, format and words); UX-63..67 retired as moved to CORE-2, CORE-4, CORE-5, CORE-5, CORE-6. UX-57..62 untouched; template starters not copied.
- CI pin in .github/workflows/dev-standards.yml bumped to 0b389c4.
- AGENTS.md and .github/pull_request_template.md cite CORE-1..7.
- CHANGES.md C53..C55; gallery rebuilt; docs_index.py build run.
- docs_check.py --strict: 0 errors, 0 warnings. scripts/design vitest: 103 passed.
