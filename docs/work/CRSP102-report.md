# CRSP102 report: agent recovery screen (web-console R5.33)

Branch: CRSP102-recovery-screen (from main 83317c3).

## Plan
1. State word `needs recovery` in the machines list and the detail facts.
2. Recovery section on machine detail (apps/web/src/screens/machines/Recovery.tsx): message, has, needs, since, one admin action Recover (busy: Recovering; locked after; could-not-start message).
3. Mock and e2e fixtures await a handler's reply.
4. Vitest, Playwright (flows, design-layout, a11y), design guards.
5. Docs: R5.33 built, operations R5.44 note, content.md words + CHANGES C23, change notes.

## Status
- [x] branch, matching golangci-lint 2.15.0 (go1.27.4) on PATH, hooks chmod (unstaged)
- [ ] code
- [ ] tests
- [ ] docs
- [ ] PR
