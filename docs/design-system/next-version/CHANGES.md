# Changes from v4

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->
- C1: component 65 (stepper) is removed: Help is rebuilt as layout G (the job path on top, every question card in one grid, no wizard, no step lock; D58 replaces D55), so nothing uses it. The job path sets `aria-pressed` only when a part is lit, and the `primary` guard leaves the boxes of the job path out like tabs and chips (components.md 64, 65, `packages/ui` Help, `e2e/tests/web-console/ux-guards.ts`; LOOK47).
