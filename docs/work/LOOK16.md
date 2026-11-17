# LOOK16 report: section spacing options (review, no decision)

Source of the gap: `Stack` (`packages/ui/src/components/layout.tsx`) -> `.ds-stack[data-gap='normal']` = `--ds-space-4` in `packages/ui/src/components.css`. `ConsoleTab` in `apps/web/src/screens/settings/Settings.tsx` puts the four panes (`.ds-pane`, title cut into the border) in one default Stack. Inside a pane: `gap: --ds-space-3`, padding `--ds-pane-inner` (12px, 16px from 600px).

Finding: measured gap today is **16px**, not 24px. Scale: 4, 8, 12, 16, 24, 32, 48. The title overhangs the border by half a line, so the visible gap is smaller still.

Options (real app, mocked API from `e2e/tests/web-console/fixtures.ts`, Phosphor dark, injected CSS override while shooting; committed code unchanged):
- today: 16px
- A: 32px (--ds-space-6; the 24px step is skipped, as the brief's example)
- B: 40px (not a token; the next token is 48px)
- C: 32px + pane gap 16px + 8px extra padding under the title

Screens: Settings > Console and Settings > Access at 1300 and 393 px. PNGs and `index.html` in `docs/review/LOOK16/`.
Note: the override targets the top-level Stack of the tab, so Access changes too. A real change would be a `Stack` gap prop on the tab, or a new section gap token, in `next-version` first.
Docs: none, review only.
