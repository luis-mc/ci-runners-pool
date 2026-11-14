# CRP5 report: feature spec `runners`

Branch: `CRP5-spec-runners` (from `main` 5bedb33). No PR (by brief).

## Status

- [x] Branch made, report written
- [x] `docs/features/runners/spec.md` written: 38 functional (R5.1 to R5.38) and 9 non-functional (R6.1 to R6.9) requirements, each with a milestone and a planned test in section 9
- [x] `docs_index.py build` and `docs_check.py` run (dev-standards luismc-docs 2.6.1)
- [x] Committed and pushed

## Inputs read

- `docs/overview/product.md`, decisions 0001 to 0005 (0003 isolation backends), `docs/architecture/stack-profile.md`, design system v1 `ux-rules.md` (UX-61, UX-62 and others).
- dev-standards `afe3235`: `docs/features/runner-pool/spec.md` (R5.1 to R5.45), `claude/plugins/delivery/scripts/delivery_runner_pool.py`, `delivery_ci_setup.py`, `templates/runner-pool/*`, tests `test_dl310_windows_runner.py`, `test_dl315_runner_remove_token.py`.

## Check result

- `docs_check.py`: 1 error, W1, for this report under `docs/work/`. Expected: the brief puts the report here; `docs_work.py strip` removes it before the join.
- Planned tests and paths are written without backticks, so S1/S2 do not check paths that do not exist yet.

## Open owner questions

Listed in spec section 10: symlink right only when asked (differs from dev-standards DL319); names `crp-` and `ci-runners-pool-runners`; keep newest 3 images; drain timeout 60 min; log retention; adopt hand-made runners or only replace; systemd system units; JIT through scale sets; start-time budgets.
