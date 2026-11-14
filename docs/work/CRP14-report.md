# CRP14 report: feature spec `tray`

Branch: `CRP14-spec-tray`. Scope: `docs/features/tray/`, `docs/work/`, regenerated docs files.

## Status

- [x] Branch created from `main`, report started
- [x] `docs/features/tray/spec.md` written (27 functional R5.x, 8 non-functional R6.x; each has a planned test in section 9)
- [x] `docs_index.py build` run (dev-standards luismc-docs 2.6.1); `docs_check.py` clean except W1 for this report (expected; stripped at the join)
- [x] Committed and pushed

## Notes

- Status `proposed`, everything marked NOT YET IMPLEMENTED. Planned test paths are written without backticks so the S2 check does not fail on files that do not exist yet; section 12 has no `Source:` lines for the same reason.
- Milestones: M1 Open, status, stopped state, log folder, autostart, single instance, GNOME fallback, CI smoke; M3 agent-only machines, Restart and Update with drain; M8 notices.

## Open owner questions

1. Who may get a one-time link: OS user bound once to a GitHub user (proposed), or any member of a local group signs in as owner?
2. Restart and Update yes: in the console Review step (proposed) or a native tray dialog?
3. New content.md words: Restart, Update, Quit, Open log folder, Start at login.
4. GNOME without AppIndicator: one notice then exit (proposed), or a fallback window?
5. Restart and Update in M3, notices in M8 (proposed)?
6. Start service from the tray when stopped (admin prompt): proposed not in M1.
