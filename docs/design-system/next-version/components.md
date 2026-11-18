# Components

> **Starter.** Every item in this file is a starter item. Keep, change or delete each one before v1 is approved.

One numbered section per shared component. A part that nearly fits is extended with its section, never copied (UX-2). Each section has the same five lines. The Source paths are placeholders: replace them with the real export path or file.

## 1. Page header

- **Used for:** the headline that says where you are, with an optional line below it and the page's one primary action.
- **Looks:** a large title with a quiet line below it. The primary action sits at the end of the title row.
- **Source:** `src/ui/page-header`
- **Rules:** UX-3, UX-4, UX-17.
- **Guard:** none yet.

## 2. Top menu and breadcrumbs

- **Used for:** moving between the main areas, and showing the path back up.
- **Looks:** a row of the main areas, starting on the frame edge, with the current one marked as a tab is marked: bold primary text and a 3 px underline, never a box (UX-69). A quiet trail of links shows the path back up. The top bar above it holds the product name and status on the left and Commands and the login on the right inside the same frame; at phone width it is two lines, name and login, then status and Commands.
- **Source:** `packages/ui/src/components/Shell.tsx` (`Header`, `TopMenu`)
- **Rules:** UX-1, UX-3, UX-16, UX-17, UX-69.
- **Guard:** none yet.

## 3. Tabs

- **Used for:** switching between views of the same thing. A tab never starts work. Tabs keep their panels mounted, so a tab keeps its state when the user comes back.
- **Looks:** labels over one panel. When the labels do not fit the width the row wraps onto as many rows as it needs; it never scrolls sideways (UX-68, owner decision LOOK D6). The chosen tab is bold, in the primary colour, with a 3 px underline, so colour is not the only sign. The row is a tab list with arrow-key movement. The top menu wraps the same way.
- **Source:** `packages/ui/src/components/Controls.tsx` (`Tabs`)
- **Rules:** UX-1, UX-8, UX-17, UX-68.
- **Guard:** `packages/ui/src/components/Pane.test.tsx` (Tabs).

## 4. Wizard

- **Used for:** a guided flow with a step bar on top, only the current step, and Back and the primary action at the bottom. A wizard that changes something ends with three steps, in order: Review, then the work (its own verb in the "-ing" form), then Done (UX-30). Review shows what will happen in numbers and words, and the line "Nothing has changed yet." Earlier steps stay reachable, and Review counts again after a change. Its one primary is named by the work and its count. The work step shows live progress and has no Back. Done shows what really happened, never the plan, and its one primary is the next action. A job under about a second opens Done at once. A stopped or failed job still ends at Done and says what was done and what is left. A step that only reads before Review is named by what it reads ("Reading files"), never "Checking".
- **Looks:** a step bar on top, one step in the middle, and Back and the primary action at the bottom. From 601 px up the step bar is one row with every step the same width (UX-15); on a phone the steps wrap.
- **Source:** `src/ui/wizard`
- **Rules:** UX-5, UX-4, UX-24, UX-30, UX-35.
- **Guard:** none yet.

## 5. Sticky action bar

- **Used for:** keeping the primary action in reach on a long page or a small screen. Its reason line sits above the buttons.
- **Looks:** a bar fixed to the bottom edge with a quiet reason line above the buttons. It has a soft shadow.
- **Source:** `src/ui/action-bar`
- **Rules:** UX-4, UX-14, UX-16, UX-42.
- **Guard:** none yet.

## 6. Action rows

- **Used for:** a list where each row has a name, a short line of facts and its own action.
- **Looks:** a plain row with a name, a quiet line of facts and one button at the end.
- **Source:** `src/ui/action-row`
- **Rules:** UX-8, UX-25, UX-16.
- **Guard:** none yet.

## 7. Buttons

- **Used for:** every action. Primary, secondary and quiet styles. A running button is not pressable and says it is running.
- **Looks:** a filled primary, an outlined secondary and a text-only quiet button, all with a clear focus ring.
- **Source:** `src/ui/button`
- **Rules:** UX-4, UX-8, UX-13, UX-16.
- **Guard:** none yet.

## 8. Card, card grid and facts list

- **Used for:** a pane: a boxed section; the grid that lays panes out; and a short list of name and value pairs inside a pane. Every titled part of a page is a pane (`Pane`; `Section` and `Card` are panes). A pane may carry a count after its title and actions that belong to the pane as a whole (a Make or Add button); they sit in the pane's one action row at the bottom, never on the border (UX-69). A note stays a note (component 5) inside the pane.
- **Looks:** a box border (`--ds-color-border`, corners from `--ds-radius-2`) with the title cut into the top border: `┤ Machines 3 ├`. The title and count are drawn in `--ds-color-primary` over `--ds-color-page`; the `┤ ├` marks are the border colour. A pane has one inner edge (`--ds-pane-inner`: 16 px, 12 px at phone width) for its title, fields, help text, notes and table. The action row is at the pane bottom, right aligned, Cancel then the one primary; at phone width the buttons stack full width, primary first (UX-37). Help text is as wide as its field. When focus is inside a pane, its border takes the focus ring colour (`--ds-color-focus`), so the user sees which pane has focus (UX-17). Panes sit in an even grid. The facts list has the name above its value. 
- **Source:** `packages/ui/src/components/Pane.tsx` (`Pane`), `Card.tsx`, `layout.tsx` (`Section`)
- **Rules:** UX-10, UX-1, UX-15, UX-37.
- **Guard:** none yet.

## 9. Dialog and sheet

- **Used for:** one overlay component with three forms, chosen by screen width and by purpose (UX-43). On a small screen it is a bottom sheet. On a wider screen it is a centred dialog when it changes data, or an anchored popover when it only changes the view. The one question card that asks first (Cancel left, the action right) is the dialog form (UX-9).
- **Looks:** a panel over a dimmed page, with a title and close button on top, a body in the middle and the buttons at the bottom. On a small screen it rises from the bottom edge.
- **Source:** `src/ui/dialog`
- **Rules:** UX-9, UX-17, UX-16, UX-35, UX-43, UX-44, UX-45, UX-46, UX-47, UX-48.
- **Guard:** none yet.

### Forms

| Form | When | Behaviour |
|---|---|---|
| Bottom sheet | Below `--ds-bp-sm` (600px), for both purposes | Slides up from the bottom edge. Full width. The page behind is dimmed. |
| Dialog | At `--ds-bp-sm` and wider, when it changes data (a question, a form, a confirm) | Centred. The page behind is dimmed. It is modal. |
| Popover | At `--ds-bp-sm` and wider, when it only changes the view (a filter, a sort, a display choice) | Anchored to its opener. No dimming. It closes on a click outside. |

A small-screen popover is a bottom sheet, so a thumb always reaches it. One component renders all three; a screen never builds its own overlay (UX-2).

### Anatomy

1. **Handle.** A short bar at the top edge of a bottom sheet that can be dragged down to close it. A dialog and a popover have none. A sheet without a drag has none either. The handle is decoration: the close button is the real control (UX-17).
2. **Header.** The title (a section title, one line) and a close button (at least `--ds-target-min` square, labelled "Close"). The title is what the overlay is named by.
3. **Body.** The content. It is the only part that scrolls. The header and footer stay in view.
4. **Footer.** The one primary action on the right, and Cancel on the left (UX-4, UX-24). A view-only popover has no footer: its choices apply at once, and the close button ends it.

### Sizes

| Size | Width | Use |
|---|---|---|
| Sheet | the full screen width, at most 90% of the screen height | small screens |
| Small dialog | `28rem` | a question with a short line |
| Medium dialog | `40rem` | a form |
| Popover | the width of its content, at most `20rem` | a few view choices |

The body scrolls when the content is taller than the space. The overlay never grows past the screen (UX-16).

### Tokens

- Surface: `--ds-color-surface`. Dimmed page: a `--ds-color-text` layer at a low opacity. Edge: `--ds-color-divider` and `--ds-hairline`.
- Corners: `--ds-radius-3`. Shadow: `--ds-shadow-3`.
- Gaps: `--ds-space-4` inside the header, body and footer; `--ds-space-3` between footer buttons.
- Z-order: `--ds-z-overlay` for the dimmed page, `--ds-z-dialog` for the overlay, `--ds-z-menu` for a popover.
- Motion: `--ds-duration-slow` for a sheet, `--ds-duration-base` for a dialog or popover, with `--ds-ease`.
- Focus ring: `--ds-focus-width`, `--ds-focus-offset`, `--ds-color-focus`.

### Behaviour

- **Focus trap.** While a modal form is open, Tab and Shift+Tab move only between controls inside it. The page behind is inert.
- **Escape closes.** Escape closes every form and counts as Cancel. A form with unsaved input asks first.
- **Focus in and out.** On open, focus goes to the safe choice: the first field of a form, or Cancel in a question. On close, focus returns to the opener (UX-35). If the opener is gone, focus goes to the page's heading.
- **Scroll lock.** While a modal form is open, the page behind does not scroll, and it does not jump when the lock starts or ends. A popover does not lock.
- **Outside click.** A click on the dimmed page closes a popover. It closes a sheet or dialog only when nothing is entered.
- **Motion.** A sheet slides up and a dialog fades in, both short (UX-36). Under `prefers-reduced-motion` the overlay appears and goes at once (UX-17).

### Accessibility

- The overlay has `role="dialog"`. A question that needs an answer before anything else uses `role="alertdialog"`.
- A modal form has `aria-modal="true"`. A popover is not modal and does not set it.
- It is labelled by its title (`aria-labelledby`). A line of explanation is its description (`aria-describedby`).
- The close button has a text name. The handle is hidden from assistive technology.
- Contrast and the focus ring follow UX-17 in every theme.

### When not to use it

- To tell the user something: use a message or the banner (component 18).
- For a guided flow of steps: use a wizard (component 4).
- For content the page needs to work: put it on the page (UX-14). An overlay is for a short, focused task.
- For a long form or a task of several steps: use a page.
- For a list of actions at the end of a card: use buttons in the card (UX-37).
- For one more overlay on top of an overlay: change the first one instead. Never stack them.

## 10. Pager

- **Used for:** moving through a long list. A preview ends with "See all N". The pager takes a noun ("Files 1-24 of 32").
- **Looks:** a small bar with Back and Next, and a line that names what is shown and how many there are.
- **Source:** `src/ui/pager`
- **Rules:** UX-11, UX-7.
- **Guard:** none yet.

## 11. List toolbar

- **Used for:** search, filters, the count, and the grid or list toggle above a list. The filter bar extends it: the search field, a Filter button that shows its active count, and a labelled Sort that is always visible. Active filters show as chips, with Clear all after them. The filters themselves open in a sheet (component 9) that ends with a primary "Show N items". The bar is not sticky.
- **Looks:** one row above a list with a search field, the filter button, the count and the view toggle. Every list screen (Repositories, Machines, Runners, Jobs, Images and caches, Users, Audit log) uses this one part and passes the parts in its slots: search, filters, selection (Select all N, Clear, "N selected" and the buttons that act on the selection), count, and the list's own actions (Add). The row is one line on a wide screen and wraps only when it does not fit (360 and 393 px). A screen never lays the toolbar out itself.
- **Source:** `packages/ui` `ListToolbar` (`src/ui/list-toolbar`)
- **Rules:** UX-7, UX-11, UX-16.
- **Guard:** none yet.

## 12. Segmented choices and filter chips

- **Used for:** picking one of a few views (segmented), or turning filters on and off (chips).
- **Looks:** a row of joined buttons with one chosen (segmented), or small round-ended chips that show on or off. A filter with two states, such as Pool on and Pool off, is segmented with a first choice All, never two loose chips. Chips stay for filters with more than two answers.
- **Source:** `packages/ui` `Segmented` (`src/ui/segmented`), `Chips`
- **Rules:** UX-8, UX-17, UX-22.
- **Guard:** none yet.

## 13. One-choice list

- **Used for:** picking one answer from rows (up to 6) or a drop-down (7 or more). A multi-choice list starts with Select all N and Clear.
- **Looks:** rows with a round mark where one is chosen, or a drop-down when there are many.
- **Option with detail (LOOK14):** an option may carry a name, a value and a description. The radio sits on the first line. Line 1 is the name in bold. Line 2 is the value in the normal colour, when the option has one. Line 3 is the description in the muted colour. Options are set apart by a space token and a divider line. The whole option is the click target, with a hover and a selected state (a bar on the start edge). An option's own field (such as Another address) shows under its description only while the option is chosen. A page passes the three parts as data (`Choice.label`, `Choice.detail`, `Choice.description`, `Choice.extra`) and never joins them into one label.
- **Source:** `src/ui/choice-list`, `packages/ui/src/components/Fields.tsx`
- **Rules:** UX-12, UX-22, UX-7.
- **Guard:** none yet.

## 14. Form field family

- **Used for:** a field (name, help, box, error), a toggle (saved at once) and a check box (waits for Save). Boxes come in three widths. A text area is the same field with several lines, for a list with one item per line; it keeps the same name, help and error places and takes the full width. The number field of the number keypad (37) takes `decimals` for a measure such as 16.5 GiB. A field for a secret (a password) hides what is typed; the screen never fills it in again and says beside it whether one is set. A file field lets the person choose one file in place of the browser's own file box: empty (a dashed drop zone with "Drop the file here, or" and a Choose a file button), chosen (file icon, name, size, Change and a remove button) and refused (a Problem border and the reason the caller's `validate` gave). It keeps a real hidden input for the picker, drag and drop, the `accept` filter, and the same name, help and error places; the screen reads the file and never shows what is in it, and it is locked with the rest of the form when the person may not use it. Fields that sit in a row (component 43) share one height and one baseline, and a name that is too long ends in an ellipsis with the full name in its title.
- **Looks:** a name above a box, a help line below it and an error line in the Problem tone when needed. A switch is a button with On or Off and its name always beside it; pressing the name works the switch. A check box and a radio are drawn 16 px inside a 44 px hit area (UX-16).
- **Source:** `src/ui/field`; `packages/ui/src/components/FileField.tsx`, `packages/ui/src/components/Fields.tsx`
- **Rules:** UX-20, UX-21, UX-22, UX-23, UX-24, UX-10, UX-16.
- **Guard:** `packages/ui/src/components/look6-8.test.tsx` (file field states, drop and accept).

## 15. Tables and list rows

- **Used for:** a table to compare three or more facts; rows for everything else. Rows become a stack of name and value lines on a phone. Column heads sort.
- **Looks:** a plain grid with light lines and a bold head row. Heads stay on one line and are bottom-aligned; inside a pane the first column starts on the pane's inner edge, with no extra inset (UX-69). On a phone (under 600 px) each row is a stack of `name  value` lines, the first column as the bold title line; a column marked `secondary` is left out of the stack. Given a `title` the table is drawn inside a pane with the title and the row count. The head of a sortable column is a button at least 44 px wide and high (UX-16); the row under the cursor stays in reverse video (component 41). A row that cannot be used now is shown in grey (`inactive`, UX-70): its text and links use `--ds-color-text-inactive` and links stay underlined; the reason and the link that fixes it sit in the row itself, with a `Tag`, never only in the grey.
- **Source:** `packages/ui/src/components/Table.tsx`, `packages/ui/src/components.css`
- **Rules:** UX-25, UX-16, UX-17, UX-18, UX-39.
- **Guard:** none yet.

## 16. Progress bar

- **Used for:** a wait. Filled when the total is known, animated when it is not. It always names what is happening.
- **Looks:** a thin bar that fills from the start, with a line of text that names the work.
- **Source:** `src/ui/progress`
- **Rules:** UX-29, UX-17, UX-19.
- **Guard:** none yet.

## 17. Badges and counts

- **Used for:** a short status word or number next to a name. A badge is information: it never looks like a button.
- **Looks:** a small flat label with no hover, set next to a name.
- **Source:** `src/ui/badge`
- **Rules:** UX-8, UX-26, UX-17.
- **Guard:** none yet.

A `Tag` is the small outlined label that names a kind next to a word, such as `inactive type` after Public on an inactive row (UX-70). It is flat, like a badge, and has the radius of an input. Source: `Tag` in the shared UI package. Guard: `packages/ui/src/components/look13.test.tsx`.

## 18. Messages and banner

- **Used for:** the four tones (Done, Note, Needs you, Problem); a button's one-line result; and the one app-wide banner slot.
- **Looks:** a box with a bar down its left side, an icon and a word for the tone, then one line of text.
- **Source:** `src/ui/message`
- **Rules:** UX-26, UX-27, UX-14, UX-17.
- **Guard:** none yet.

## 19. Empty, failed and error states

- **Used for:** a place with nothing to show, something that failed, or content that could not load. It says what, why and what next.
- **Looks:** a block with a short title, one line of why and one button for what next, shown once. A page passes its headline as `pageTitle` and its next action to the state only, so a failed or empty page keeps its h1 (UX-17) and the action is never also in the page header (UX-64).
- **Source:** `packages/ui/src/components/State.tsx`
- **Rules:** UX-6, UX-28, UX-3.
- **Guard:** none yet.

## 20. Selection bar

- **Used for:** acting on the items the user selected. It shows the count of what is selected and visible.
- **Looks:** a bar that appears when something is selected, with the count and the actions.
- **Source:** `src/ui/selection-bar`
- **Rules:** UX-7, UX-12, UX-13, UX-38.
- **Guard:** none yet.

## 21. Search bar and find layout

- **Used for:** the search or filter bar, and the layout of a page that finds things: the bar, then the chips or toolbar rows, then the content, always in that order at the same distances. The bar has an icon, the field, and one small x inside the field that empties it and keeps focus.
- **Looks:** a field with a search icon on the left and a small x inside on the right, then the chips, then the content.
- **Source:** `src/ui/search-bar`
- **Rules:** UX-31, UX-7, UX-16, UX-17.
- **Guard:** none yet.

## 22. Check box row

- **Used for:** one check box beside its label, with the explanation on its own line below. A choice that waits for Save uses it. A row tick and a filter chip use the same part with a hidden or styled label. It has a partial state (announced as mixed), an invalid state and a disabled state.
- **Looks:** a square box beside its label, with a quiet explanation on the line below. A row may show its label in bold over the explanation and a quiet note at the end (amber when it needs the person's attention).
- **Source:** `src/ui/check-row`
- **Rules:** UX-22, UX-16, UX-17.
- **Guard:** none yet.

## 23. Slider

- **Used for:** choosing one value on a line by dragging or pressing. It has a visible name, a track and a handle, and the current value in words given by the caller. Arrow keys step by one, Page Up and Page Down by a tenth, Home and End go to the ends. On a phone the value sits above the track so a thumb never covers it.
- **Looks:** a labelled track with a round handle and the value in words.
- **Source:** `src/ui/slider`
- **Rules:** UX-40, UX-16, UX-17.
- **Guard:** none yet.

## 24. Time axis list

- **Used for:** things that happen over time, read as one axis. It has a range bar (the chosen range, Clear, zoom out and zoom in), a chart of the range with one bar per period, and the rows under a period header with its count. The range bar and the period header dock under the top bar while the rows scroll. An empty period says so and offers to widen the range. An error keeps the rows already drawn.
- **Looks:** a range bar on top, a bar chart under it, then rows grouped under period headers that show a count.
- **Source:** `src/ui/time-axis`
- **Rules:** UX-33, UX-6, UX-16, UX-18.
- **Guard:** none yet.

## 25. Page jump map

- **Used for:** jumping to any page of a long paged thing by seeing all of them. It is a grid of page tiles in reading order, each a small picture with its number. The current page is ringed and says "Now". A tile jumps there and closes the map. A page that cannot be drawn keeps its number and a quiet "No picture". It opens from one button as a sheet. On a phone there are four tiles across.
- **Looks:** a grid of small page pictures, each with its number. The current one has a ring and the word Now.
- **Source:** `src/ui/page-map`
- **Rules:** UX-32, UX-16, UX-17.
- **Guard:** none yet.

## 26. Live log

- **Used for:** a program's lines as they are written. It has a title, a Show choice (everything, warnings and errors, errors only), Follow new lines, a Full window button that grows the card over the page (Esc and "Back to normal size" shut it), and one quiet note on what is kept and that secrets are taken out. Each line has a time, the level written out, and the message. Lines come from one helper, so a job writes one started line, a progress line at most once a minute, and one finished line.
- **Looks:** a card with a title, a row of controls, and lines that each show a time, a level word and a message, in a monospace face.
- **Source:** `src/ui/live-log`
- **Rules:** UX-16, UX-17, UX-35.
- **Guard:** none yet.

## 27. Activity strip

- **Used for:** the one place that says what runs now. Closed, it is one line: the label, one running mark, the lead job's name, its bar, the count and time left, "+K more", and a button "Show all N jobs". Open, the lead shows in full and the others are aligned rows. One job shows no button. The choice is remembered per person, and a missing store never breaks it. A new or failed job opens it once. The lead is the job that ends last.
- **Looks:** a one-line strip with a running mark, the lead job's name and bar, and a button to open the rest. Open, it shows aligned rows.
- **Source:** `src/ui/activity-strip`
- **Rules:** UX-34, UX-19, UX-29, UX-17.
- **Guard:** none yet.

## 28. Dates, times and numbers

- **Used for:** the one formatter for every date, time, number, size, percent and time left. No screen builds its own string. The formats are in content.md.
- **Looks:** no look of its own. It gives every screen the same text for a date, a size and a count.
- **Source:** `src/lib/format`
- **Rules:** UX-18.
- **Guard:** none yet.

## 29. Table export

- **Used for:** the Export button of a table. It writes every row in the order shown, neutralises text that looks like a formula, and names the file for what it holds, then the date and time. A page that offers it does not name the file format in its lead.
- **Looks:** one quiet button at the end of a table's toolbar.
- **Source:** `src/ui/table-export`
- **Rules:** UX-39, UX-25, UX-18.
- **Guard:** none yet.

## 30. Picture card, grid and rail

- **Used for:** a thing that is a picture (a cover, a portrait, a photo) shown as a tile with its title and one quiet line. The whole tile is one link. A small badge may sit on the corner and a bar may show progress. Tiles sit in a grid that fills whole rows, or in one horizontal rail. A tile lifts a little on hover and focus, and never over the next tile. Placeholders keep the final size, so nothing moves while loading. Items that are not pictures are rows, not tiles.
- **Looks:** a picture tile with its title and one quiet line below. Tiles sit in an even grid or one sideways rail.
- **Source:** `src/ui/picture-card`
- **Rules:** UX-10, UX-11, UX-8, UX-16, UX-36.
- **Guard:** none yet.

## 31. Chart with a text alternative

- **Used for:** numbers over time or in shares, drawn as inline SVG to scale, labelled, in token colours. Each chart has a text or table alternative. A chart shows the top N and then "See all N". Key numbers are lettered figures, never tiles.
- **Looks:** a drawn chart with labelled axes and token colours, and a table or text under it. Key numbers are large lettered figures.
- **Source:** `src/ui/chart`
- **Rules:** UX-41, UX-17, UX-18, UX-11.
- **Guard:** none yet.

## 32. Shared component rules

- **Used for:** the rules every component above follows. A component that breaks one is extended, never copied (UX-2).
- **Looks:** no look of its own. It sets how the parts above treat each other.
- **Source:** `src/ui`
- **Rules:** UX-1, UX-2, UX-8, UX-13, UX-37.
- **Guard:** none yet.

| Component | Rule |
|---|---|
| Primary button | One per region. It is named by what it does. |
| Secondary button | Grouped in one actions row next to the primary. In a card, one per line at the card width. |
| Danger button | Always followed by the in-page question card (UX-9), never a browser box. |
| Link | Used for navigation, and inside running text. An action is never a plain link. |
| Metadata line | Quiet text with a middle dot between facts. Equal years collapse ("2015", not "2015-2015"). |
| Status text | Plain text, emphasis by weight. A warning is a quiet line with its action. |
| Tag | A small flat label with no hover and no focus. It never looks like a button. |
| Section | A heading with a hairline. No heavy boxes round ordinary content. |
| Panel | Only for a self-contained unit that needs framing. It is the one shared card. |
| Progress | A thin bar plus text ("page 12 of 24"), not a boxed chip. |
| Bulk action | Names its scope in the label ("Move all 12 files"), then a preview, then a question, then Undo. |

## 33. Other shared parts

- **Used for:** smaller parts that every screen shares. Reuse them, extend them, never copy them. The icon set: one set, and an icon beside a tone always has a word too (UX-26). The help line: one quiet line under a control, in a sentence that ends in a full stop. The compact row: one layout for an item and a group of items, with a 44 px tick target, a title on one line, one quiet second line, and at the end a size or a chevron that opens the group in place. The facts list: name and value pairs with a thin line between rows, each name above its value in a narrow card. The data hooks: the one way a screen loads and pages a list, so loading, empty and failed states are the same everywhere. Emoji are never functional icons: an icon that does a job is from the icon set. An emoji may mark a celebration.
- **Looks:** small shared parts: an icon, a quiet help line, a compact row and a facts list.
- **Source:** `src/ui`
- **Rules:** UX-2, UX-6, UX-8, UX-16, UX-17.
- **Guard:** none yet.

## 34. Change review

- **Used for:** reviewing a list of proposed changes before they are applied, such as the Review step of a wizard (component 4). A summary bar shows the counts. Each count filters the list when pressed. Change chips show the kinds of change, each with its count. A changed part is marked by more than colour: a word, an icon or a line style (UX-26). A conflict is never ticked by default, and a line says why it is a conflict. One sticky action at the bottom applies the ticked changes and shows their count.
- **Looks:** a bar of counts across the top, a row of chips under it, then the rows with a tick, a name and a mark for the kind of change. A bar fixed to the bottom holds the one action.
- **Source:** `src/ui/change-review`
- **Rules:** UX-4, UX-7, UX-12, UX-26, UX-17, UX-16.
- **Guard:** none yet.

<!-- luismc-docs component: date-picker -->
## 35. Date picker

- **Used for:** every date the user enters: a date of birth, a start date, moving something to another day. It replaces a native date input and a keypad for dates. Counts, measures and codes use the number keypad; times use the time picker.
- **Looks:** the field name and the chosen date in words over a rule; a row with previous and next month buttons around a month select and a year select; a month grid of day buttons with the weekday initials on top; and a typed entry under the grid. The chosen day is the primary fill. Today has a thicker edge. A day outside the range has a dashed edge.
- **Source:** `packages/ui/src/pickers/DatePicker.tsx` (logic in `date-picker-logic.ts`, styles in `date-picker.css` and `picker-base.css`)
- **Rules:** UX-56, UX-16, UX-17, UX-20, UX-22, UX-43.
- **Guard:** the template's unit tests (`DatePicker.test.tsx`): keyboard, value and limits. With the enforcement kit, `scripts/design/raw-inputs.test.ts` bans a native date input (UX-56).

### Behaviour

- **Value.** An ISO day (`YYYY-MM-DD`) or nothing. A day is picked by pressing it, or by typing it and pressing Enter or leaving the box.
- **Bounds.** `min` and `max`. Days outside are disabled, the month buttons stop at the range, and the year select offers only the years in it. A typed day outside the range is refused with a line that names the range.
- **Typed entry.** Three numbers in the locale's order (`DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`), separated by `/`, `.`, `-` or a space. A two-digit year and a day that does not exist are refused with a line that shows the pattern.
- **Shown value.** The header shows the chosen day through `formatValue`. Without it, the header shows the locale's long date ("14 March 2009"). This default is on purpose: a long date is easier to check, for example a date of birth. `formatValue` is the hook for the project's one date formatter; pass it when the header must match the content.md format (year-month-day).
- **Locale.** Month and weekday names, the order of the typed numbers and the week start (Monday by default) follow the locale.
- **Where it opens.** Inline, or inside the project's one overlay component (a sheet on a phone, a popover or dialog on a wider screen) with Cancel and Done. It builds no overlay of its own.

### Keyboard and assistive tech

- The picker is a group named by its field name. The day grid is an ARIA grid with one tab stop (WAI-ARIA APG, date picker).
- Arrow keys move a day or a week. Home and End go to the start or end of the week. Page Up and Page Down change the month; with Shift, the year. Keys never leave the range.
- Enter or Space picks the focused day. Escape cancels when the picker sits in an overlay.
- Each day is named in full ("Saturday 14 March 2009"). Today is `aria-current="date"`. The chosen day is `aria-selected`.
- Every button, select and box is at least `--ds-target-min` square and shows the focus ring (`--ds-focus-width`, `--ds-color-focus`) on keyboard focus.

### Words (content.md)

"Previous month", "Next month", "Month", "Year", "Or type the date", "Type the date as {pattern}.", "Pick a date from {min} to {max}." `design_system.py components` adds each word that is not there yet to the Component words table of content.md. A project changes them there and passes them through the `labels` prop.

<!-- luismc-docs component: time-picker -->
## 36. Time picker

- **Used for:** times of day and durations. `units` sets the columns: `h` for an hour setting, `hm` for a time of day such as a reminder, `hms` for a duration such as a rest or a timed hold. It replaces a native time input and a keypad for times.
- **Looks:** the field name and the value over a rule; then one column per unit, each an up key, the number in a large tabular figure, and a down key, with ":" between columns. The clock is 24-hour by default (UX-18); the locale never changes it. A caller may ask for 12-hour with `hourCycle`, which adds an AM/PM switch after the last column. An optional row of quick-pick chips sits below; the chip that matches the value is pressed.
- **Source:** `packages/ui/src/pickers/TimePicker.tsx` (logic in `time-picker-logic.ts`, styles in `time-picker.css` and `picker-base.css`)
- **Rules:** UX-56, UX-16, UX-17, UX-20, UX-22, UX-43.
- **Guard:** the template's unit tests (`TimePicker.test.tsx`): keyboard, value and limits for `h`, `hm` and `hms`. With the enforcement kit, `scripts/design/raw-inputs.test.ts` bans a native time input (UX-56).

### Behaviour

- **Value.** Always 24-hour text: `HH`, `HH:MM` or `HH:MM:SS` by `units`. The 12-hour clock is display only.
- **Clock.** 24-hour by default; 12-hour when the locale's clock is 12-hour, or when `hourCycle="h12"` is set.
- **Steps.** `step` sets the minute and second step (5 for a reminder). Hours step by 1. A value off the step snaps to the next step.
- **Limits.** Hours 0 to 23, minutes and seconds 0 to 59. Up and Down wrap (23 to 00).
- **Known limit.** There is no `maxHours` prop: a duration of 24 hours or more cannot be entered. Add it when a real need comes.
- **Where it opens.** Inline, or inside the project's one overlay component with Cancel and Done. On a dense settings screen the quick picks may also sit under the closed field.

### Keyboard and assistive tech

- The picker is a group named by its field name. Each number is a `spinbutton` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax` and `aria-valuetext` ("30 minutes") (WAI-ARIA APG, spinbutton).
- Up and Down change the value by the step. Page Up and Page Down by 3 hours, 15 minutes or 15 seconds. Home and End go to the lowest or highest value. Left and Right move between columns.
- Enter is Done and Escape cancels, when the caller passes `onDone` and `onCancel`.
- The up and down keys are for touch and pointer; they are out of the tab order because the keyboard already steps the number. Each is at least `--ds-target-min` square and named ("More minutes").

### Words (content.md)

"Hours", "Minutes", "Seconds", "More {unit}", "Fewer {unit}", "Morning or afternoon", "Quick picks", "{n} hours", "{n} minutes", "{n} seconds". The AM and PM words come from the locale. `design_system.py components` adds each word that is not there yet to the Component words table of content.md. A project changes the others there and passes them through the `labels` prop.

<!-- luismc-docs component: number-keypad -->
## 37. Number keypad

- **Used for:** counts, measures and codes only: a number of repetitions, a weight, a distance, a quantity, a one-time code. Many quick entries in a row. Never for a date, a time or a duration: those use the date picker and the time picker. It replaces a native number input.
- **Looks:** the field name; the value in a large tabular figure in a box, with its unit after it; a range line under the value ("From {min} to {max}."); a 3 by 4 grid of keys filling the width (1 to 9, then Clear in the bottom-left key, or "." when there are decimals, then 0 and Delete last digit in the bottom-right key); a quiet reason line. Inside the one overlay (`embedded`) the keypad shows no title and no buttons of its own: the overlay has the one title, and its footer has one Cancel on the left and Done as the primary on the right (UX-44). The overlay is about 420 px wide (`Dialog size="keypad"`) and a full-width sheet on a phone. Stand-alone, the keypad keeps its own title, Cancel and Done.
- **Source:** `packages/ui/src/pickers/NumberKeypad.tsx` (logic in `number-keypad-logic.ts`, styles in `number-keypad.css` and `picker-base.css`); the overlay use is `NumberField` in `packages/ui/src/components/Controls.tsx`
- **Rules:** UX-56, UX-16, UX-17, UX-20, UX-22, UX-43, UX-44.
- **Guard:** the template's unit tests (`NumberKeypad.test.tsx`): keyboard, value and limits for a number and a code. With the enforcement kit, `scripts/design/raw-inputs.test.ts` bans a native number input (UX-56).

### Behaviour

- **Value.** Text, so a code keeps its leading zeros. `kind="number"` (default) or `kind="code"`.
- **First key.** It opens with the current value; the first key replaces it, as a native field does.
- **Limits.** `decimals` (0 has no "." key), `min`, `max` and `maxLength`. A key that would pass `max`, the decimals or `maxLength` is refused. Done is disabled below `min`, on an empty value, or on a code shorter than `maxLength`, and the reason line says why.
- **Known limit.** There is no minus key and no `allowNegative` prop: a negative number cannot be entered. Add it when a real need comes.
- **Where it opens.** Inline, or inside the project's one overlay component (a sheet on a phone). It builds no overlay of its own.

### Keyboard and assistive tech

- The keypad is a group named by its field name. The value is an `output` that is announced when it changes.
- Digits, "." and Backspace type from anywhere inside it. The keys are one tab stop; arrow keys move between them, Home and End go to the first and last key. Enter on a key presses it; Enter elsewhere is Done. Escape cancels.
- Every key and button is at least `--ds-target-min` high and shows the focus ring on keyboard focus.

### Words (content.md)

"Delete last digit", "Clear", "Cancel", "Done", "Type a number.", "The lowest is {min}.", "The highest is {max}.", "Type all {n} digits.", "From {min} to {max}." `design_system.py components` adds each word that is not there yet to the Component words table of content.md. A project changes them there and passes them through the `labels` prop.

## 38. Command palette and shortcut list

- **Used for:** the keyboard-first entry of UX-57. `Ctrl+K` (`Cmd+K` on macOS) opens a search over the areas, the items found by name and the commands the user's role allows. Focus starts in the search box. Typing filters; Down and Up (and `j` and `k` outside the box) move through the results, `Enter` opens one, `Escape` closes. `?` opens the list of every shortcut. Both sit in the one overlay of component 9 and use the search bar of component 21. A command opens the one place where it lives (UX-52).
- **Looks:** a dialog with a search bar over a list of results. A result names the thing and says its kind in a quiet word (area, machine, command). The chosen result has a weight and a tint, never colour alone. The shortcut list is a facts list of key and action.
- **Parts:** `SearchList` (`packages/ui/src/components/SearchList.tsx`) is the search box, the filtered list, the arrow movement and `Enter`; the palette uses it and a list page may too. `ArrowNavigation` (`packages/ui/src/components/Navigation.tsx`) is mounted once in the shell and gives every page Down, Up, `j` and `k` (UX-57). A page never wires its own arrow keys.
- **Source:** `packages/ui/src/components/Shell.tsx` (`ResultList`, `ShortcutTable`), `packages/ui/src/components/SearchList.tsx`, `packages/ui/src/components/Navigation.tsx`, `apps/web/src/shell/Shell.tsx`
- **Rules:** UX-17, UX-43, UX-44, UX-46, UX-47, UX-57.
- **Guard:** none yet.

## 39. Copyable command block

- **Used for:** a command the user copies and runs elsewhere, such as the install command of a machine. The Copy button copies the text and says "Copied". It changes nothing else.
- **Looks:** a monospace block that wraps long lines, with the Copy button under it.
- **Source:** `packages/ui/src/components/Controls.tsx` (`CodeBlock`)
- **Rules:** UX-1, UX-17, UX-27.
- **Guard:** none yet.

## 40. Level meter

- **Used for:** a level against a limit that is not a wait: memory, CPU and slots against a machine's budget (UX-41). The value is also said in words, so the bar never stands alone (UX-17).
- **Looks:** a name, a thin bar filled to the level, and the value in words ("40% of 80%"). Over the limit the fill changes tone and the words say so.
- **Source:** `packages/ui/src/components/Progress.tsx` (`LevelBar`)
- **Rules:** UX-17, UX-41, UX-58.
- **Guard:** none yet.

## 41. Selected row and key-hint bar

- **Used for:** showing which list row is selected, and which keys work (UX-57).
- **Looks:** the selected row of a table or a result list, the row under the cursor (`j` and `k`, or a click or Tab), is in reverse video: `--ds-color-primary` fill with `--ds-color-on-primary` text. A row the user has ticked (a choice list) takes the `--ds-color-selection` fill and keeps its text colour. The key-hint bar is fixed at the window foot, with a thin top border; its keys sit inside the page frame (UX-69). Each key is listed once, whatever the spelling (`j / k` and `j k` are one key). It lists only the keys that work on the page: a page registers its keys (`useKeyHints`) and a part that adds keys registers them too, so `j / k` and `Enter` show only where a list exists. Each key is in the key style of component 38. The hints are text, never buttons (UX-8). The bar is not drawn on a touch or coarse pointer, where there are no keys.
- **Source:** `packages/ui/src/components/Table.tsx`, `packages/ui/src/components/KeyHints.tsx` (`KeyHints`, `useKeyHints`), the `hints` slot of `Frame`, `packages/ui/src/components.css`
- **Rules:** UX-8, UX-50, UX-57, UX-60.
- **Guard:** none yet.

## 42. Theme choice

- **Used for:** the Theme choice in Settings, Appearance (UX-60): a one-choice list (component 13) of the six themes.
- **Looks:** each row shows the theme name and, under it, a small row of that theme's colours (surface, primary, Done, Note, Needs you, Problem) in a box in the theme's page colour. The swatches are drawn from the theme's own tokens; the row is decoration and the name carries the meaning. The theme row may show a `ThemePreview` of that theme in dark and one in light (`Choice.preview`) instead of the swatch row; Settings, Appearance does. A choice with previews is drawn as cards in a grid, 3 per row on a desktop, 2 on a tablet and 1 on a phone; each card holds the radio, the theme name and the dark and light previews side by side, the whole card is the choice, and the selected card has a 2 px primary border. The mode (system, dark, light) is a second one-choice list beside it. `ThemePreview` is a small live sample of a theme in dark or light: a pane with its title in the border, a selected row in reverse video and a primary button, all from that theme's tokens. It is a picture with one label, not a control.
- **Source:** `packages/ui/src/components/Fields.tsx` (`Choice.swatch`), `packages/ui/src/components/ThemePreview.tsx`, `packages/ui/src/themes.ts`
- **Rules:** UX-22, UX-55, UX-60.
- **Guard:** `scripts/design/themes.test.ts` (tokens and contrast); `apps/web/src/screens/settings/Settings.test.tsx` (picking and keeping a theme).

## 43. Field grid

- **Used for:** a form's short fields (numbers, short text) that belong together, such as the budget and slots of a machine.
- **Looks:** the fields sit in equal-width columns (auto-fill, at least 200 px), as many as fit the width, and fold to one column on a phone. Each name sits on one line above its box (an ellipsis and a title when it is too long, UX-20), every box has the same height and the boxes sit on one baseline. Fields never touch (UX-10). Settings, Retention uses it.
- **Source:** `packages/ui/src/components/layout.tsx` (`FieldGrid`), `packages/ui/src/components.css`
- **Rules:** UX-10, UX-15, UX-16, UX-20.
- **Guard:** `e2e/tests/design-layout.spec.ts` (layout at 360, 393 and 1300 px).

A field's width caps its box, never its name and help: a lone field's name and help use the width of the section, one line each on a desktop, and the box keeps its own width below (component 14, LOOK10). Side by side in a row, a field is as wide as its box.

## 44. GitHub grant

- **Used for:** every place that needs an App permission or repository access it lacks (Set up parity, Turn on the pool, Repositories, the pool per organization).
- **Looks:** a needs-you message with one step list: each step has its label on the left and, next to it, its state word (done, missing) and its text (UX-15). One primary external button opens the page of the next missing step in a new tab; a later step is plain text. When everything is granted it is a done message that says Ready.
- **Behaviour:** it checks again when the tab regains focus and every 15 seconds while it waits, and calls the page once when everything is granted. Only addresses on `https://github.com/` are opened.
- **Source:** `packages/ui/src/components/Grant.tsx` (`GithubGrant`).
- **Rules:** UX-15, UX-26, UX-38, UX-58.
- **Guard:** `packages/ui/src/components/Grant.test.tsx`, `e2e/tests/web-console/a11y.spec.ts`.

## 45. Ordered list

- **Used for:** choosing the order of a fixed set of items, where each item is used once (the queue order in Budgets).
- **Looks:** one list of numbered rows, `1  Repository priority  [↑] [↓]`. The two icon buttons sit at the right of the row and stay there at phone width; each is 44 px (UX-16). Move up is disabled on the first row, Move down on the last. An item cannot be chosen twice, so a duplicate is impossible.
- **Behaviour:** Move up and Move down swap the row with its neighbour. With a row focused, Alt+ArrowUp and Alt+ArrowDown do the same and focus follows the row. A live line says the new place. A stored value with a repeated or missing item is normalised on load: the first of each is kept and the missing are appended in the default order.
- **Source:** `packages/ui/src/components/OrderList.tsx` (`OrderList`, `normaliseOrder`), `packages/ui/src/components.css`
- **Rules:** UX-16, UX-20.
- **Guard:** `packages/ui/src/components/OrderList.test.tsx`, `apps/web/src/screens/settings/Budgets.test.tsx`.
- **Words:** see content.md, Ordered list words.

## 46. Open row

- **Used for:** a list where each row is one item that opens its own screen: a bold name, one status line (a Status or quiet text) and a quiet note at the end. The whole row is the button; Enter opens it. No table, no tool lists in the row.
- **Looks:** a plain row with a hairline below, the name above the status line, the note at the end followed by a chevron. On a phone the note drops under the line.
- **Source:** `packages/ui/src/components/Rows.tsx`
- **Rules:** UX-16, UX-25, UX-57, UX-58.
- **Guard:** `e2e/tests/web-console/ux-routes.spec.ts` (touch, layout).

## 47. Folded section

- **Used for:** detail a person rarely needs: one line that opens it in place.
- **Looks:** a triangle and one line; the opened part sits under it with the same spacing as a pane body.
- **Source:** `packages/ui/src/components/Rows.tsx`
- **Rules:** UX-16, UX-10.
- **Guard:** none yet.

## 48. Action bar

- **Used for:** the main action of a screen, always in the same place and the same order (UX-71, UX-4). Selection screens, edit screens, list screens with one main action, and every wizard.
- **Looks:** one bar, sticky at the foot of the main content, above the key-hint bar (component 41), with a thin top border and the page fill. It never scrolls away. Left to right: the status line in muted text ("2 selected", "Unsaved changes (3)"; none when there is nothing to say), the secondary actions (Cancel, Back, Stop), the one primary action. A disabled primary says why next to it (UX-38). From 600 px down the bar is full width and the buttons stack at equal width, the primary on top, the secondary actions under it. A wizard draws its Back, Stop and primary through this part; a wizard inside a screen that has its own bar sits in the flow (not sticky) and draws default buttons. A tab of many sections (Settings) has one bar: each section registers what it changed with the tab, the status counts them all, and Save sends each changed section in turn.
- **Source:** `packages/ui/src/components/ActionBar.tsx` (`ActionBar`, `selectedStatus`, `unsavedStatus`), `packages/ui/src/components/Wizard.tsx`, `packages/ui/src/components.css`
- **Rules:** UX-4, UX-13, UX-38, UX-71.
- **Guard:** `scripts/design/action-bar.test.ts` (a primary button outside the bar, or two in it, fails; `action-bar.known.json` only shrinks).

## How to add a component

- Give it the next number.
- Write the five lines: Used for, Looks, Source, Rules, Guard.
- Looks says in words what it looks like. It holds no values: a token name or a size belongs in tokens.md.
- Cite the UX rules it follows by ID.
- Add a `CHANGES.md` entry.
