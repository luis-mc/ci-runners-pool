# Changes from v2

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->
- C135: UX-72 cited `e2e/tests/review/review-layout.spec.ts`, which does not exist; its Guard now names `e2e/tests/web-console/ux-jobs-rows.spec.ts` (the `rowHeights`, `rowActionWords`, `wrapped`, `wordBroken` and `cutText` guards of `e2e/tests/web-console/ux-routes.spec.ts` cover every other table); the Row action words note in content.md names the same files (ux-rules.md, content.md; RES21 T8, LOOK35).
- C136: the `none yet` Guard entries of UX-13, UX-38, UX-42 and components 5, 7, 20 name their guards, and component 48 adds the `stickyWalk` guard next to `action-bar.test.ts` (ux-rules.md, components.md; RES21 G2, LOOK35).
- C137: the action bar and the edit bar are drawn by `Frame` as a direct child of the main column, and the page reserves the real height of the key-hint bar (components.md 41, 48; RES21 B02, B03, B19, N3, N5; LOOK37).
- C138: a message body and a chip never break a word: no `overflow-wrap: anywhere` on them, and a chip stays on one line; the long buttons get short words: `Set up parity`, `Add a repository` (content.md; RES21 B11 to B14, N4; LOOK37).
