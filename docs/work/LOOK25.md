# LOOK25 report

Owner (2026-11-17): Policy fields not aligned (CORE-7, UX-23).

Cause (measured on /repositories/octo/app, before): Cluster rows centred their items and the number button was content-sized (128 px vs 77 px), so a wrapped name moved one box 12 px lower; the check box drawn 14 px right of the field column (44 px hit area around a 16 px box).

Fix, shared parts only (`packages/ui/src/components.css`, no app CSS, no app change):
- a Cluster that holds fields sits on its bottom edge (`align-items: end`), so a wrapped name grows upward and the boxes share one top line;
- a field in a Cluster is exactly its width class wide (short 8rem, medium 20rem); the box fills it, so number fields are the short width;
- a check box or radio row pulls its hit area left so the drawn box is on the field column's left edge (cards and structured options unchanged).
Screens covered by the shared parts: repository policy, machine policy, pool size, add runners, add machine, settings tabs (they use NumberField/TextField/CheckRow, which this CSS governs). FieldGrid screens already aligned.

Guard (`scripts/design/dom-layout.ts`): new rules `field-row` (width class, box width, top edge) and `check-edge` (drawn left edge vs field column), at 360/393/1300. `e2e/tests/design-layout-fields.spec.ts` proves it fails on bad HTML. Repository policy added to `e2e/tests/design-layout.spec.ts`. Run on old CSS: policy spec fails (field-row, check-edge at all three widths); on new CSS: all 47 layout specs pass. `layout.known.json` stays empty; no entry added.

Docs: components.md 14 and CHANGES C87 in next-version; change note docs/features/web-console/changes/LOOK25.md (written by hand: `docs_fold.py` is not in this sandbox; folding it at release is unchanged). `docs_check.py` not run for the same reason.

Screenshots: docs/review/LOOK25/{before,after}-{desktop-1300,phone-393}.png.

Not run: full CI. Local Node is 22 (repo wants 24): installed with --ignore-scripts so core.hooksPath stays unset; Playwright used the preinstalled Chromium through an untracked local config (removed).
