# CRSP140 report: TUI panes on every screen

Branch `CRSP140-tui-panes`, from main f6f720c.

## Findings
- Card already draws the pane border; `Section` is a plain heading, so no page section is a pane.
- j/k moves DOM focus to a `data-list-row`; focus has no reverse-video look. Only checked rows use the primary fill.
- Settings tabs are a wrapping flex row (UX-15 broken at 1232 px).
- Access list: `ParitySetupAction` does not tell `AccessCredentials` to reload; backend does create the credential.
- "Make an access" form always open.
- Setup state backend (`AnyPoolOn`, memory store) is right and tested; the banner trusted `/setup` only.

## Plan
1. Design system next-version: Pane (8), Tabs overflow (3), selected row (41), CHANGES C39..
2. `Pane` in packages/ui; `Section` and `Card` render it; Table cursor row reverse video; Tabs overflow into More.
3. Screens: every section is a Pane (through Section/Card, no per-screen styling).
4. Access page: reload after parity, form behind "Make an access".
5. Banner: first repository counts when any repository has the pool on.
6. Tests, change note, PR.

## Status
- [ ] 1 [ ] 2 [ ] 3 [ ] 4 [ ] 5 [ ] 6
