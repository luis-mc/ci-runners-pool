# Changes from v2

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->

- C1: Registry words added (incl. the words of the image page, budgets, mirror, replace wizard and the pulling step of Add runners) and rule UX-73: a cleanup the owner decides is a recommendation with one primary at the foot, a cleanup crsp does alone says its date, and a deletion of an image a runner uses is refused with the job named on the question card (content.md Registry words, ux-rules.md UX-73; RES20 owner decision D18, REG5)
- C135: UX-72 cited `e2e/tests/review/review-layout.spec.ts`, which does not exist; its Guard now names `e2e/tests/web-console/ux-jobs-rows.spec.ts` (the `rowHeights`, `rowActionWords`, `wrapped`, `wordBroken` and `cutText` guards of `e2e/tests/web-console/ux-routes.spec.ts` cover every other table); the Row action words note in content.md names the same files (ux-rules.md, content.md; RES21 T8, LOOK35).
- C136: the `none yet` Guard entries of UX-13, UX-38, UX-42 and components 5, 7, 20 name their guards, and component 48 adds the `stickyWalk` guard next to `action-bar.test.ts` (ux-rules.md, components.md; RES21 G2, LOOK35).
- C137: components 1, 2, 3: the page header is one page gap (`--ds-space-5`) under a tab row on every screen with sub-tabs; the first tab label starts on the frame edge like the title and the top menu (a tab has no side padding, labels are `--ds-space-5` apart, never cut, a label that does not fit goes whole to the next row); on a phone the Menu button box sits on the same frame edge (`TopMenuButton`); guards `tabEdges` and `tabGap` (components.md 1, 2, 3, ux-rules.md UX-69; owner report 19 Nov 2026, LOOK36)
- C138: the action bar and the edit bar are drawn by `Frame` as a direct child of the main column, and the page reserves the real height of the key-hint bar (components.md 41, 48; RES21 B02, B03, B19, N3, N5; LOOK37).
- C139: a message body and a chip never break a word: no `overflow-wrap: anywhere` on them, and a chip stays on one line; the long buttons get short words: `Set up parity`, `Add a repository` (content.md; RES21 B11 to B14, N4; LOOK37).
