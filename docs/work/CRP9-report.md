# CRP9 report: feature spec `observability`

Status: SPEC DONE.

Summary: wrote docs/features/observability/spec.md (status proposed, 32 R5 + 14 R6 = 46 requirements, each with a planned test in section 9); NOT YET IMPLEMENTED throughout.

## Steps

1. Branch `CRP9-spec-observability` from `main` (5bedb33). Report started.
2. Read product brief, decisions 0001-0005, stack profile, ux-rules v1, DOCSPEC section 4, the feature-spec template, and dev-standards `ci_runs.py`, `ci_watch.py`, `test_ci_runs.py` (cloned at afe3235).
3. Wrote the spec. Choices: SSE over WebSocket (one-way flow, plain net/http, built-in reconnect with Last-Event-ID); logs in a separate `logs.db` with FTS5; audit row in the same transaction as the change (fails closed); rates copied from GitHub's Actions runner pricing page with source URL and date, owner-editable.
4. Ran `docs_index.py build` and `docs_check.py --base origin/main`: only W1 (this report under docs/work/, expected on an agent branch; the join strips it).

## Notes

- Planned test paths in section 9 are plain text, not backticked, because `docs_check.py` S2 fails on backticked paths that do not exist yet. Section 12 uses no `Source:` lines for the same reason (S1).
- `docs_index.py build` also regenerated docs/architecture/decisions.md (the six spec decisions and the generator version line), features/index.md, docs-map.json, llms.txt and index.html.

## Open owner questions

1. Retention defaults in R6.8 (history 90 d, logs 14 d and 512 MiB per machine, audit 400 d).
2. Default rates copied from GitHub's pricing at build time; subtract any GitHub self-hosted per-minute fee (setting, default 0)?
3. Logs and audit log: admins and owner only, or viewers too?
4. Public repositories: count minutes but no money?
5. Audit hash chain (R5.28) before milestone 8?
