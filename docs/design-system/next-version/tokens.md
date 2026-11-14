# Tokens

> **Starter.** Every item in this file is a starter item. Keep, change or delete each one before v1 is approved.

Use tokens and nothing else: no raw colour, size or font in a screen. The values are given here and nowhere else.

**Prefix:** `--ds-`

## How themes work

- The dark values are the default. The console looks like a terminal.
- The light values apply under `@media (prefers-color-scheme: light)` and under `[data-theme=light]`. The attribute wins over the system setting.
- The tables list the light value first and the dark value second.
- A token has the same name in every theme. Only its value changes.
- Text and its background meet WCAG 2.2 AA contrast in every theme (UX-17): at least 4.5:1 for text, 3:1 for large text and for borders of controls. WCAG 2.2 AA stays the rule. A project may choose 7:1 for body text in the dark theme.

```css
:root { --ds-color-page: #0a0e0d; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark]) { --ds-color-page: #f3f6f4; }
}
[data-theme=light] { --ds-color-page: #f3f6f4; }
```

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ds-color-page` | `#f3f6f4` | `#0a0e0d` | page background |
| `--ds-color-surface` | `#ffffff` | `#111816` | cards, dialogs, inputs |
| `--ds-color-text` | `#0d1a14` | `#d7e2dc` | body text |
| `--ds-color-text-muted` | `#45574e` | `#93a79e` | secondary text, hints |
| `--ds-color-border` | `#6b7b73` | `#62766d` | borders of controls |
| `--ds-color-divider` | `#d2dcd7` | `#22302b` | lines between sections |
| `--ds-color-primary` | `#006a77` | `#5ee6f0` | the primary action, links in text |
| `--ds-color-on-primary` | `#ffffff` | `#04181b` | text on the primary action |
| `--ds-color-done` | `#0a6b33` | `#46e08f` | the Done tone |
| `--ds-color-done-bg` | `#e3f5ea` | `#0e2a1b` | background of Done |
| `--ds-color-note` | `#006779` | `#5ed3e8` | the Note tone |
| `--ds-color-note-bg` | `#def3f7` | `#0a2a30` | background of Note |
| `--ds-color-needs-you` | `#8a5200` | `#ffb84d` | the Needs you tone |
| `--ds-color-needs-you-bg` | `#fff1d6` | `#2e2208` | background of Needs you |
| `--ds-color-problem` | `#b3261e` | `#ff7a7a` | the Problem tone |
| `--ds-color-problem-bg` | `#fde8e6` | `#351416` | background of Problem |
| `--ds-color-focus` | `#006a77` | `#5ee6f0` | the focus ring |

A tone is never shown by colour alone (UX-26). It always has a word and a glyph too (UX-58).

Terminal mapping: Done is green (healthy), Needs you is amber (waiting), Problem is red (failed), Note is cyan (info).

### Text on a fill

Text on a fill comes in pairs. Every fill role has its own `on-` text token. A fill and its text are always set together, and never mixed with another pair. The kit's contrast guard reads these pairs.

- A solid fill is `--ds-color-X` with its text `--ds-color-on-X`.
- A tint fill is `--ds-color-X-tint` with its text `--ds-color-on-X-tint`.
- The `-bg` tokens above have the value of the tint. Keep them until every screen uses the tint pair.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ds-color-on-done` | `#ffffff` | `#06110c` | text on a solid Done fill |
| `--ds-color-done-tint` | `#e3f5ea` | `#0e2a1b` | a quiet Done fill |
| `--ds-color-on-done-tint` | `#0a6b33` | `#46e08f` | text on the Done tint |
| `--ds-color-on-note` | `#ffffff` | `#06110c` | text on a solid Note fill |
| `--ds-color-note-tint` | `#def3f7` | `#0a2a30` | a quiet Note fill |
| `--ds-color-on-note-tint` | `#006779` | `#5ed3e8` | text on the Note tint |
| `--ds-color-on-needs-you` | `#ffffff` | `#06110c` | text on a solid Needs you fill |
| `--ds-color-needs-you-tint` | `#fff1d6` | `#2e2208` | a quiet Needs you fill |
| `--ds-color-on-needs-you-tint` | `#8a5200` | `#ffb84d` | text on the Needs you tint |
| `--ds-color-on-problem` | `#ffffff` | `#06110c` | text on a solid Problem fill |
| `--ds-color-problem-tint` | `#fde8e6` | `#351416` | a quiet Problem fill |
| `--ds-color-on-problem-tint` | `#b3261e` | `#ff7a7a` | text on the Problem tint |

## Type families

System monospace stacks only. Nothing is bundled and nothing is loaded from the network. All text is monospace, like a terminal.

| Token | Value | Use |
|---|---|---|
| `--ds-font-body` | `ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | all text |
| `--ds-font-mono` | `ui-monospace, "Cascadia Mono", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace` | code, logs |

## Type scale

| Token | Value | Use |
|---|---|---|
| `--ds-size-1` | `0.75rem` | badge |
| `--ds-size-2` | `0.875rem` | hint, secondary text |
| `--ds-size-3` | `1rem` | body, label, button |
| `--ds-size-4` | `1.125rem` | subtitle |
| `--ds-size-5` | `1.25rem` | section title |
| `--ds-size-6` | `1.75rem` | page title |
| `--ds-line-height` | `1.5` | body text |
| `--ds-line-height-tight` | `1.25` | titles |

## Type roles

Each role names its weight. The ceiling is the heaviest weight the role may use. A role never goes above its ceiling, and no role uses a weight outside the weight tokens.

| Token | Value |
|---|---|
| `--ds-weight-regular` | `400` |
| `--ds-weight-semibold` | `600` |
| `--ds-weight-bold` | `700` |

| Role | Size | Weight | Ceiling | Family |
|---|---|---|---|---|
| Page title | `--ds-size-6` | 700 | 700 | `--ds-font-body` |
| Section title | `--ds-size-5` | 600 | 600 | `--ds-font-body` |
| Subtitle | `--ds-size-4` | 400 | 400 | `--ds-font-body` |
| Body | `--ds-size-3` | 400 | 600 | `--ds-font-body` |
| Label | `--ds-size-3` | 600 | 600 | `--ds-font-body` |
| Button | `--ds-size-3` | 600 | 600 | `--ds-font-body` |
| Secondary | `--ds-size-2` | 400 | 600 | `--ds-font-body` |
| Hint | `--ds-size-2` | 400 | 400 | `--ds-font-body` |
| Badge | `--ds-size-1` | 600 | 600 | `--ds-font-body` |
| Code | `--ds-size-2` | 400 | 400 | `--ds-font-mono` |

## Spacing

| Token | Value | Use |
|---|---|---|
| `--ds-space-0` | `0` | none |
| `--ds-space-1` | `4px` | tight gaps |
| `--ds-space-2` | `8px` | gap inside a control |
| `--ds-space-3` | `12px` | gap between related items |
| `--ds-space-4` | `16px` | default gap, page gutter on a phone |
| `--ds-space-5` | `24px` | gap between cards |
| `--ds-space-6` | `32px` | gap between sections |
| `--ds-space-7` | `48px` | page padding on wide screens |
| `--ds-target-min` | `44px` | smallest touch target (UX-16) |

## Radius

| Token | Value | Use |
|---|---|---|
| `--ds-radius-1` | `2px` | inputs, badges |
| `--ds-radius-2` | `2px` | buttons, cards |
| `--ds-radius-3` | `4px` | dialogs, sheets |
| `--ds-radius-round` | `999px` | chips, switches |

## Shadows

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ds-shadow-1` | `0 0 0 rgba(0, 0, 0, 0)` | `0 0 0 rgba(0, 0, 0, 0)` | cards: a thin border, no shadow |
| `--ds-shadow-2` | `0 2px 6px rgba(0, 0, 0, 0.12)` | `0 0 0 1px rgba(0, 0, 0, 0.6)` | sticky bars, menus |
| `--ds-shadow-3` | `0 8px 24px rgba(0, 0, 0, 0.18)` | `0 0 0 1px rgba(0, 0, 0, 0.8)` | dialogs, sheets |

## Effects

The terminal glow and scanline appear only on the focused control (UX-59). Nothing else glows. Under `prefers-reduced-motion: reduce` the scanline is off and the glow does not animate.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ds-glow-focus` | `0 0 0 1px #006a77` | `0 0 0 1px #5ee6f0, 0 0 8px rgba(94, 230, 240, 0.55)` | added to the focus ring |
| `--ds-scanline-focus` | `none` | `repeating-linear-gradient(0deg, rgba(94, 230, 240, 0.06) 0 1px, transparent 1px 3px)` | background layer of the focused control |
| `--ds-cursor-blink` | `1000ms` | `1000ms` | the caret block in the command palette; `0ms` (steady) under reduced motion |

## Breakpoints

A screen works from 360 px up (UX-16). Write layouts mobile first.

| Token | Value | Use |
|---|---|---|
| `--ds-bp-min` | `360px` | the smallest supported width |
| `--ds-bp-sm` | `600px` | phone to tablet |
| `--ds-bp-md` | `900px` | tablet to desktop |
| `--ds-bp-lg` | `1200px` | wide screens |
| `--ds-bp-xl` | `1600px` | very wide screens |

CSS cannot read a custom property inside a media query. Write these values in the query itself.

## Layout

| Token | Value | Use |
|---|---|---|
| `--ds-card-min` | `280px` | smallest card width in a card grid (UX-10) |
| `--ds-width-field-short` | `8rem` | short box (UX-23) |
| `--ds-width-field-medium` | `20rem` | medium box (UX-23) |
| `--ds-width-field-full` | `100%` | full box (UX-23) |

### Per width

These tokens take a different value at each width. The gutter is the space at the side of the page. The padding is the space above and below the content. Write the changes in a media query (see Breakpoints).

| Token | Below `--ds-bp-sm` | `--ds-bp-sm` and up | `--ds-bp-lg` and up | Use |
|---|---|---|---|---|
| `--ds-page-gutter` | `16px` | `24px` | `48px` | space at the side of the page |
| `--ds-page-padding` | `16px` | `24px` | `32px` | space above and below the page content |

### Frame widths

| Token | Value | Use |
|---|---|---|
| `--ds-frame-narrow` | `40rem` | a page of one form or one column of text |
| `--ds-frame-wide` | `72rem` | a page of cards, tables or lists |

### Control heights

| Token | Value | Use |
|---|---|---|
| `--ds-control-height` | `44px` | a button, a field and a select. Never below `--ds-target-min` |
| `--ds-control-height-large` | `52px` | the one primary action on a small screen |

## Border widths

The list is closed. A screen uses one of these and no other width.

| Token | Value | Use |
|---|---|---|
| `--ds-border-thin` | `1px` | control borders, dividers, rules between rows (`--ds-hairline`) |
| `--ds-border-medium` | `2px` | the Note edge; a chosen tile |
| `--ds-border-thick` | `3px` | the focus ring; the Done and Needs you edges |
| `--ds-border-double` | `6px` | the Problem edge, always a double line |

## Motion

| Token | Value | Use |
|---|---|---|
| `--ds-duration-fast` | `100ms` | hover, press |
| `--ds-duration-base` | `200ms` | open and close |
| `--ds-duration-slow` | `400ms` | sheets, page changes |
| `--ds-duration-loop` | `1200ms` | one turn of a looping bar or spinner |
| `--ds-duration-reduced` | `0ms` | every duration under reduced motion |
| `--ds-duration-screen` | `300ms` | a screen entering |
| `--ds-duration-progress` | `300ms` | the fill of a progress bar moving to a new value |
| `--ds-duration-toast` | `5000ms` | how long a passing message stays |
| `--ds-ease` | `cubic-bezier(0.2, 0, 0, 1)` | all movement |
| `--ds-ease-in-out` | `cubic-bezier(0.42, 0, 0.58, 1)` | movement that starts and ends at rest |

Motion has a purpose: it shows where something came from or went to (UX-36).

Under `prefers-reduced-motion: reduce` every duration is `0ms` and nothing animates, except a progress bar of unknown total, which shows a static striped fill (UX-17, UX-29).

## Row heights

Starter values. Change to fit.

| Token | Value | Use |
|---|---|---|
| `--ds-row` | `56px` | a list row without a picture (UX-25) |
| `--ds-row-picture` | `88px` | a list row with a picture |
| `--ds-hairline` | `1px` | a thin quiet edge or rule between rows |
| `--ds-icon-size` | `16px` | a small icon beside text |

## Tone shapes

A tone is also told by the shape of its edge, so it never rests on colour alone (UX-26). Starter values. Change to fit.

| Tone | Edge |
|---|---|
| Done | `3px solid` |
| Note | `2px solid` |
| Needs you | `3px dashed` |
| Problem | `6px double` |

| Token | Value | Use |
|---|---|---|
| `--ds-tone-bar` | `12px` | the bar down the left of a message |

## Focus

| Token | Value | Use |
|---|---|---|
| `--ds-focus-width` | `3px` | width of the focus ring |
| `--ds-focus-offset` | `2px` | gap between a control and its ring |

- Every control shows the ring on `:focus-visible`, in `--ds-color-focus` (UX-17).
- Under `forced-colors: active` the ring uses the system colour `Highlight`.

## Z-order

One scale. A screen never writes a raw `z-index` (UX-1).

| Token | Value | Use |
|---|---|---|
| `--ds-z-base` | `0` | page content |
| `--ds-z-sticky` | `100` | sticky bars and docked headers |
| `--ds-z-menu` | `200` | menus and pop-overs |
| `--ds-z-overlay` | `300` | the dimmed page behind a dialog |
| `--ds-z-dialog` | `400` | dialogs and sheets |
| `--ds-z-toast` | `500` | the one app-wide banner when it floats |

## Density

A project may offer a compact density. It changes only these tokens. The touch target stays `--ds-target-min` (UX-16).

| Token | Comfortable | Compact | Use |
|---|---|---|---|
| `--ds-row` | `56px` | `44px` | list row height |
| `--ds-space-3` | `12px` | `8px` | gap between related items |
| `--ds-space-5` | `24px` | `16px` | gap between cards |

## Use your own font

1. Add a family token, for example `--ds-font-brand`, with the font and then the system stack as fallback.
2. Point the role you want to change at it (for example, the page title) in this file.
3. Load the font file from the project's own files. Never from another site.
4. Check the contrast and the line length again.
5. Add a `CHANGES.md` entry.

## Add a named theme

1. Choose a name, for example `high-contrast`.
2. Give every colour token a value under `[data-theme=high-contrast]`. A theme never leaves a token out.
3. Check WCAG 2.2 AA contrast for each pair (UX-17).
4. Add a way to pick the theme in the settings.
5. Add a `CHANGES.md` entry.
