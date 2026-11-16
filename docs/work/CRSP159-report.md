# CRSP159 report

Done: five Settings tabs (D8) with anchored panes, old addresses redirect, Menu button below 601 px, idle update state words, 24 h backup time, dark default (server, theme-init), tests, change notes.

Not done: ThemePreview per theme and the visible Switch name (CRSP157 parts, not on main yet). `/settings/access` and `/settings/repositories` stay the tab itself, so they open the tab without scrolling to the old section.
Checks: tsc, eslint, prettier, Vitest (2 failures also on main: AuditLog and ConfigExport blob text), go test auth and api. Playwright left to CI. golangci-lint binary is built with go1.25 and cannot read the go 1.27.4 config; gofmt clean.
