# CRSP24 report: web console M1 screens

Status: started. Updated after each step.

## Plan
1. Shared UI parts in packages/ui (format, button, status, message, cards, table, fields, dialog, wizard, states, shell parts) + one stylesheet on --ds-* tokens.
2. App foundation: API wrapper, session/auth, live store (SSE + reconnect), shell, palette, shortcuts.
3. Screens: sign-in, setup wizards, overview, repositories, machines, runners, settings.
4. Vitest per screen; Playwright e2e on a mocked API; docs notes.

## Done
- (nothing yet)

## Open questions
- Node here is v22; repo wants >=24 (installed with engine-strict off).
