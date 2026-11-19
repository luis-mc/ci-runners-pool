# Changes from v2

One entry per change, `- C<n>: what changed (file; source)`.

<!-- - C1: what changed (file; source) -->
- C135: UX-72 cited `e2e/tests/review/review-layout.spec.ts`, which does not exist; its Guard now names `e2e/tests/web-console/ux-jobs-rows.spec.ts` (the `rowHeights`, `rowActionWords`, `wrapped`, `wordBroken` and `cutText` guards of `e2e/tests/web-console/ux-routes.spec.ts` cover every other table); the Row action words note in content.md names the same files (ux-rules.md, content.md; RES21 T8, LOOK35).
- C136: the `none yet` Guard entries of UX-13, UX-38, UX-42 and components 5, 7, 20 name their guards, and component 48 adds the `stickyWalk` guard next to `action-bar.test.ts` (ux-rules.md, components.md; RES21 G2, LOOK35).
- C137: Button and Chip are as wide as their label: `white-space: nowrap`, `flex: none`, `min-inline-size: max-content`; the table action column keeps its label whole and a one-line table keeps a cell's buttons on one line (components.md 7, 57; RES21 B04, B11 to B13, T2, LOOK39).
- C138: Row action words lists Edit, Replace, Delete registration, Revoke, Copy and On, Off, and the `rowActionWords` guard reads them from this table; components 57 names them (content.md, components.md; RES21 B09, T5, LOOK39).
- C139: two long labels get short words so they stay on one line at phone width: *Types: Private (default)* (was Active types) and *Set up parity* (was Set up parity for this repository) (content.md; RES21 B11, B12, LOOK39).
- C140: UX-72 Guard names `ux-routes.spec.ts` beside `ux-jobs-rows.spec.ts`, the file that measures the rows and the row action words of every table (ux-rules.md; RES21 G2, LOOK39).
