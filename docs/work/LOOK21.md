# LOOK21: unsaved changes, options (review)

Owner (2026-11-17): on edit pages Cancel/Save sit at the foot, out of view; the user changes an option and forgets to save. Review task: options only, no decision. App code is unchanged on this branch.

## What is here

- `docs/review/LOOK21/index.html`: the screen list and the options side by side (1300 px and 393 px, Phosphor dark, today's baseline included).
- `docs/review/LOOK21/*.png`: 35 shots. Names: `<screen>-<option>-<desktop|phone>-<clean|changed>.png`, plus `-leave.png` for option C's "Discard changes?".
- `docs/review/LOOK21/prototype.patch`: the three options as a patch on `apps/web` (`?v=a|b|c` switches them; no `?v` is today). Not applied, not committed to app code.
- `docs/review/LOOK21/capture.ts`: the Playwright script (existing `e2e/tests/web-console/fixtures.ts` mock, stateful for PATCH/PUT) that made the shots.

Re-run: apply the patch, `cd apps/web && pnpm exec vite --port 5199`, then `CHROMIUM=<chrome path> node docs/review/LOOK21/capture.ts`.

## Screens with a Save/Cancel form

| Screen | File | Note |
|---|---|---|
| Repository detail (policy, hosted fallback, packages) | `repositories/Repositories.tsx:913` | Shown. Long, 3 panes; Save is far below the first fields. |
| Settings, Repositories tab: Budgets | `settings/Budgets.tsx:209` | Shown. |
| Machine detail settings | `machines/Machines.tsx:518` | Cancel leaves the page; Save asks first. |
| Image detail, Layers | `images/ImageDetail.tsx:169` | Already disabled until a change (close to option C). |
| Settings, Console: Notifications | `settings/Notifications.tsx:594` | Add/edit a channel. |
| Settings, Access: Access for CI | `settings/AccessForCi.tsx:214` | Make a credential. |
| Settings, Access: Users | `settings/Settings.tsx:341` | Add user; edit user is a dialog with Save. |
| Settings, Data: Retention | `settings/Settings.tsx:586` | |
| Settings, Data: Backups | `settings/Settings.tsx:726` | |

## Options, what the shots show

- **A sticky bar**: bar at the viewport foot only when something changed, "Unsaved changes (n)", Cancel, Save; a bar marks each changed field. It sits above the key-hint bar on a mouse screen. Needs one shared part (UI package) and a changed-field count per form. On a phone the bar is two stacked buttons and takes about a fifth of the screen. Works the same on every form above, including long ones.
- **B save at once**: no Save button; "Saving…" then "✓ Saved" and Undo next to the field for 7 s. Risky changes (public forks, hosted-fallback cost) still reach the existing question. Cost: one request per edit; a form that saves several fields as one (policy + packages, budgets + queue) saves the whole form each time; no way to review a set of changes first; typed fields need a pause rule (prototype waits 600 ms). Does not fit Add/Make forms.
- **C top and bottom**: Cancel and Save at the form head and foot, disabled until a change; leaving by a link with changes asks "Discard changes?" (the prototype guards in-app links and tab close; browser Back is not guarded because the router is not a data router, so a real build would need `useBlocker`). On a long form the top pair is out of view as soon as the user scrolls, so the foot problem moves with the scroll; the leave question is the real safety net.

## Notes for the decision

- A and C can combine (C's leave guard also fits A).
- Prototype caveats: shots use a mocked API; in B the chip timing is wall-clock, so a late field can still read "Saving…" in a shot. Colours use existing tokens only; the prototype uses inline `style=` and so would not pass the no-app-CSS scan as is. A real build moves the bar and marker into `packages/ui`.
- `docs_check.py` (luismc-docs) is not available in this sandbox, so it was not run. The change adds only review files; no feature spec changed. Docs: none, review task.

CODE DONE
