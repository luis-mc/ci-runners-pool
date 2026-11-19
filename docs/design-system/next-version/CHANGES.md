# Changes from v2

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->
- C135: UX-72 cited `e2e/tests/review/review-layout.spec.ts`, which does not exist; its Guard now names `e2e/tests/web-console/ux-jobs-rows.spec.ts` (the `rowHeights`, `rowActionWords`, `wrapped`, `wordBroken` and `cutText` guards of `e2e/tests/web-console/ux-routes.spec.ts` cover every other table); the Row action words note in content.md names the same files (ux-rules.md, content.md; RES21 T8, LOOK35).
- C136: the `none yet` Guard entries of UX-13, UX-38, UX-42 and components 5, 7, 20 name their guards, and component 48 adds the `stickyWalk` guard next to `action-bar.test.ts` (ux-rules.md, components.md; RES21 G2, LOOK35).
- C137: UX-51 and component 56: a long name (machine or runner, card title) breaks anywhere and stops at two lines (`ClampText`, `.ds-clamp`, pane title), a card body and the card grid row gap leave room for a two-line title; Pool size ends its rows with the row action *Open* (components.md, components.css; RES21 B06 B07 B08 N2, LOOK38)
- C138: heatmap day labels are the short weekday on the grid and the full weekday in the table (`Heatmap` row `short`; content.md Mon to Sun; RES21 B15, LOOK38)
