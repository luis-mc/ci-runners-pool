# CRSP157 report: shared UI parts (packages/ui)

Branch `CRSP157-shared-ui`, base `865788d`. Area: packages/ui (+ theme-init default, theme data default).

Plan (status updated per step):
1. Default theme Phosphor dark (D11): themes.data.ts, regenerated tokens.css, themes.ts, theme-init.js. [done]
2. Tabs wrap, no sideways scroll; rule UX-68.
3. 44 px hit area: link, checkbox, radio, sort, breadcrumb.
4. Table: two-line phone fold, `title` wraps it in a Pane, sort heads, reverse-video row kept.
5. Switch shows its name.
6. Key-hint registry, fixed bar, hidden on coarse pointers.
7. Empty/Failed: one action, page h1 kept.
8. TimePicker 24 h default.
9. ThemePreview part.
10. Docs: next-version CHANGES + components, web-console change note.
