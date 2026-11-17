# LOOK22: pool size as a settings section (review, options only, no decision)

Owner (2026-11-17): the 4-step "Pool size" wizard inside the machine's settings page is not intuitive. Wants a plain section with the Review check run live while editing, and a "Recommended" option. This is a REVIEW: three options shown, none chosen. Committed app code is unchanged.

Open `docs/review/LOOK22/index.html` (side by side, desktop 1300 and phone 393, Phosphor dark). PNGs sit next to it: `<option>-<state>-<desktop|phone>.png`.

## How the shots were made
Real console (`apps/web`) in Chromium, API mocked with the existing `MockApi` of `apps/web/src/testing/mock.tsx`. The harness is in `docs/review/LOOK22/harness/`: a vite config that swaps the `./PoolSize` import of `Machines.tsx` for the option file (`OPTION=A|B|C`; none = today's wizard), `mock.ts` (a JS copy of `internal/poolsize/budget.go`: floor, CPU budget, memory room, 1.5 GiB per CPU, shrink needs a yes), `shoot.cjs`, `make-index.py`. Figures as the owner gave: machine 31.7 GiB, used outside 16.4, budget 26.9, room 10.5, CPU budget 19; now 4 GiB and 2 CPUs. Nothing in `apps/web` or `packages/ui` is edited.

## The options
- **Today**: wizard Size, Review, Saving, Done inside the page; Review button, Back, own save state.
- **A, plain section**: facts (now, room, CPU budget); radio Recommended / Custom (Custom shows Pool memory and Pool CPUs); live check line under it; one Save (page pattern: busy "Saving", then a "done" message). No step row. Parts used: `ChoiceField` (with `extra`), `NumberField`, `Facts`, `Message`, `Button`, `FormActions`, `CheckRow`. All exist, no new part.
- **B, sliders + room bar**: bar of the machine memory (used outside, pool, free; dashed line at the end of the room), sliders with -/+ steppers, "Use recommended" button, live line, Save. Needs NEW shared parts (slider/stepper, stacked room bar); the harness draws them with inline styles only for the picture. The slider also loses exact typing and the keypad of `NumberField` (UX-56).
- **C, A plus summary and Edit**: read-only facts and an Edit button; Edit makes the section editable in place (same radio/inputs/live line), Save and Cancel in the section; Save returns to the summary with the "pool size is ..." message. Same parts as A.

States shown: clean, (C: editing clean), recommended chosen, editing ok (6 GiB, 4 CPUs), editing warning (9 GiB: "Fits, but leaves 1.5 GiB for this PC"), editing error (12 GiB: more than the room, with the nearest size that fits), saving (PATCH held open, Save busy "Saving"), saved. The `back-to-ok` shot is an extra step in the sequence.

## Live check and Recommended
The live line calls the same `POST /machines/{id}/pool-size-check` that Review uses today (250 ms after the last edit, last answer wins). Tones: ok = done, warning = needs-you, error = problem. Warning when the check passes but the room left after the pool (`room_gib - mem`) is under 3 GiB (my threshold, owner to confirm), or when the size lowers the pool (then the "Yes, lower the pool size" box stays, as today). Error text is the controller's `reason` plus `nearest`. Save is disabled with a reason while the check runs, fails, or nothing changed.

**The controller computes no recommended size today.** `poolsize.Check` returns the room, the CPU budget and `nearest` sentences only. The options compute it in the page from the check's figures:
- memory = half of `room_gib`, rounded down to a whole GiB, at least 4 GiB (10.5 gives 5 GiB);
- CPUs = half of `cpu_budget` (19 gives 9), but no more than memory / 1.5 (the controller's 1.5 GiB per CPU rule, 5 GiB gives 3), at least 2.
Result "Recommended (5 GiB, 3 CPUs)". Note: the owner's example "8 GiB, 8 CPUs" would be refused by the controller (8 CPUs need 12 GiB; room is 10.5), so the label is computed, not fixed. If an option is chosen, better to add `recommended_memory_gib` and `recommended_cpus` to `PoolSizeCheck` (Go `poolsize.Check` plus openapi) so the rule lives in one place and is tested; that is a small API change, not done here. Half of the room is conservative; three quarters (7 GiB, 4 CPUs) is the other obvious choice; the owner decides.

## Other settings that use a wizard the same way
- Updates: `UpdateWizard` in `apps/web/src/screens/settings/Updates.tsx`, embedded on the Settings Updates tab, but it goes to its own review page (`UpdateReviewPage`, navigates back to the settings path). This is the case the owner called weird: a wizard that changes pages.
- Add runners (`AddRunners.tsx`), Turn on a pool for a repository (`TurnOnPool.tsx`), Add machine (`AddMachine.tsx`), Setup (`Setup.tsx`): full-page wizards for a create flow; a step flow is reasonable there.
- Pool size is the only wizard embedded in a settings section with a save of its own beside the page's own Save.

## Things to see in the shots
- A and B each add a Save inside the section while the page keeps its own Save/Cancel at the bottom (not in the cropped shots): two Saves on one page. C has the same issue while editing. The wizard has the same today. Option to fix: make the section part of the page's Save (one Save, check line only), not shown here.
- On the phone, the fixed key-hints bar of the app overlaps some element screenshots (a capture artefact of cropping a tall element).

## Environment notes
- `pnpm install` ran the repo's `prepare` script, which set `core.hooksPath` to `.githooks` in this clone. I tried to unset it; the sandbox refused, so it is left as the repo script set it. No hook was bypassed.
- `golangci-lint` was installed with `GOTOOLCHAIN=go1.27.4`.
- Node here is 22; the repo wants 24 (install used `--config.engine-strict=false`; the harness only needs vite).

## Docs
Docs: none, review only (screenshots, harness and this report; no behaviour change).
