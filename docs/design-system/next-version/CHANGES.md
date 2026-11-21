# Changes from v4

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->
- C1: component 65 (stepper) is removed: Help is rebuilt as layout G (the job path on top, every question card in one grid, no wizard, no step lock; D58 replaces D55), so nothing uses it. The job path sets `aria-pressed` only when a part is lit, and the `primary` guard leaves the boxes of the job path out like tabs and chips (components.md 64, 65, `packages/ui` Help, `e2e/tests/web-console/ux-guards.ts`; LOOK47).
- C2: UX-10 says the sections of every page are 32 px (`--ds-space-6`) apart and a search, filter or step bar above a pane leaves the same gap, so a focus ring never covers a pane title. The shared parts hold it: the page, a stack that holds panes, the search table and the wizard use the section gap; the DOM layout rules `section-gap` and `title-clear` (`scripts/design/dom-layout.ts`, run by `e2e/tests/web-console/ux-routes.spec.ts` at 360, 393 and 1300 px) check it (ux-rules.md UX-10, packages/ui components.css; LOOK46).
- C3: Native update window words: `Waiting for another installer` with `{name} is installing. Windows installs one program at a time; this update starts when it finishes.` (`Another program` without a name), and `Restarting the service` shows only once the installer has finished (content.md Native update window words and the Update page live line; TRAY11).
