# CRP11 report: feature spec `operations`

Branch: `CRP11-spec-operations` (from `main` 5bedb33). No PR.

## Status

- [x] Branch made, inputs read (product brief, decisions 0001-0005, stack profile, release.yml, UX rules, template, DOCSPEC 4)
- [x] Wrote `docs/features/operations/spec.md`: 44 requirements (R5.1-R5.34, R6.1-R6.10), each with a milestone and a planned test in section 9; everything NOT YET IMPLEMENTED
- [x] `docs_index.py build` (dev-standards 2.6.1), `docs_check.py`: only W1 (this report), expected on the branch
- [x] Commit and push

## Notes

- `docs_check.py` W1 (files under `docs/work/`) is expected on this branch; strip before the join.
- Planned test paths in section 9 are plain text, not code spans, so S2 does not fail on files that do not exist yet.
- Title is plain `Operations` (a colon in the front matter title would break YAML).
- Backup, restore and the drill are placed in M1 (stack profile section 9 needs a drill before the first release), though the brief lists backup in M8. Owner question 5.

## Open owner questions (spec section 11)

1. Config file format: TOML (proposed), YAML or JSON.
2. Optional second backup folder (backups are on the same disk).
3. Secrets not backed up: accept re-entry on a new machine, or add a passphrase-encrypted secrets export.
4. Default update policy for headless machines: ask (proposed) or auto.
5. Confirm backup, restore and drill in M1 instead of M8.
6. Install script checks SHA-256 only until signed installers (M8).
7. Move the GitHub runner pin within 7 days of a new release.
8. Controller `--purge-data`: offer to delete repository variables and the GitHub App, or only explain how.
9. Edge to stable switch when stable is older: wait for the next stable (proposed).
