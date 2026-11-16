# CRSP140 report: TUI panes on every screen

Branch `CRSP140-tui-panes`, from main f6f720c.

## Findings
- Card already draws the pane border; `Section` is a plain heading, so no page section is a pane.
- j/k moves DOM focus to a `data-list-row`; focus has no reverse-video look. Only checked rows use the primary fill.
- Settings tabs are a wrapping flex row (UX-15 broken at 1232 px).
- Access list: `ParitySetupAction` does not tell `AccessCredentials` to reload; backend does create the credential.
- "Make an access" form always open.
- Setup state backend (`AnyPoolOn`, memory store) is right and tested; the banner trusted `/setup` only.

## Done
- Design system next-version: components 3, 8, 41; tokens `--ds-frame-wide` 76rem; CHANGES C39 to C42.
- `Pane` in packages/ui; `Section` and `Card` render it; cursor row reverse video; tabs one row, scroll, arrow keys.
- Access list reloads after Set up parity; form shown only after Make an access.
- Banner: first repository done when the repository list has a pool-on repository (backend `AnyPoolOn` was already right and tested).
- Tests: Vitest (ui 54, web 331), design scans 103, Playwright design-layout (39) and a11y (70) green, keyboard, flows, deep-link green.
- Environment: pre-push needed golangci-lint v2.15.0 built with go1.27.4 and Node 24; neither is in the sandbox.
