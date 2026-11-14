# CRP13 report: feature spec `cli`

Branch: `CRP13-spec-cli`. Status: spec written, docs check clean.

## Steps

- [x] Branch from `main`, report written.
- [x] Read inputs (product brief, decisions 0001 to 0005, OpenAPI, main.go, content words, template, DOCSPEC §4).
- [x] Write `docs/features/cli/spec.md` (27 functional R5.x, 8 non-functional R6.x, each with a test row in §9).
- [x] Rebuild index (`docs_index.py build`), `docs_check.py`: 0 errors, 0 warnings.
- [x] Commit and push.

## Notes

- Planned test paths are plain text in §9 (no backticks) so the S2 check does not fail before the files exist.
- `update --check` became `update --dry-run`: "Check" is a retired word in content.md.
- Other spec folder names are assumed: `runners`, `web-console`, `tray`, `doctor`, `config-as-code`, `backup`, `updates`. Known from branches: `github-integration`, `machines`, `scheduling`, `caches`.

## Owner questions

1. `runner create` vs content rule "Add, never Create": rename to `runner add`?
2. Milestone of the `tray` mode (spec says M8).
3. `config import` without `--dry-run`: refuse and point to `config apply` (spec), or apply after a yes?
4. Does `backup` include secrets (encrypted with a passphrase) or leave them out?
5. Token through an environment variable (`CRP_TOKEN`) for scripts, or `login` only?
6. Command library: standard `flag` or `spf13/cobra`?
7. Commands for users, notifications, budgets, images and caches, audit log: here or in their own specs?
8. Confirm the assumed folder names of other specs.
