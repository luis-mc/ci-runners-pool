# CRP7 report: feature spec `caches`

Branch: `CRP7-spec-caches` (from `main` at 5bedb33). No PR (by brief).

## Steps

- [x] Branch created, report started.
- [x] Read brief, decisions 0001-0005, stack profile, UX rules v1, template, DOCSPEC section 4.
- [x] Verify the Actions cache service protocol (v2 Twirp). See spec section 7.1.
- [x] Read dev-standards `ci_tool.py`, `tools.json`, `test_dl115_ci_tool.py` (plus `test_dl194`, `test_ds199`, `test_dl189`).
- [x] Write `docs/features/caches/spec.md` (35 functional, 11 non-functional requirements; each has a planned test in section 9).
- [x] Run `docs_index.py build` and `docs_check.py`. Only finding: W1 for this report under `docs/work/` (expected; `docs_work.py strip` removes it at the join).
- [x] Commit and push.

## Findings

- Protocol checked on 2026-11-14 against `actions/toolkit` main `0c3a9c3` and `actions/runner` main `8cfa104`. v2 cache service = Twirp `github.actions.results.api.v1.CacheService` with three methods; upload uses the Azure `BlockBlobClient.uploadFile`; download is a plain GET for a non-Azure host.
- The stock runner overwrites `ACTIONS_RESULTS_URL` from the job's `ResultsServiceUrl` (`NodeScriptActionHandler.cs`), so a runner `.env` cannot redirect the cache. The spec proposes a runner patched at install (D2, owner question Q1). Redirecting the results address also catches artifacts, so non-cache calls pass through to GitHub (R5.6).
- `ci_tool.py` docstring says shared folders get 0777, but the code sets 1777 (sticky). The spec follows the code and DL194 tests.
- The stack profile says "Cache: none"; the cache store adds a local file store. Needs a stack-profile change when built (not edited here; out of scope).
- docs_check U1 does not recognise `UX-n` as a citation; lines with rule words need "design system UX-n".
- Sibling specs (scheduling, machines, web console) are not on their branches yet, so the spec names them in words, not links.

## Open owner questions

Q1 runner patch for the cache redirect; Q2 where the cache store lives; Q3 request identity (runtime token signature cannot be checked locally); Q4 default cap 20 GiB and a per-repository cap; Q5 git URL rewrite for persistent runners; Q6 tool command from the Go binary inside jobs, or also ship `ci_tool.py`.
