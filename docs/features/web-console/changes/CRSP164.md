---
change: minor
task: CRSP164
---
UX guards run on every console route (read from the route table) at 360, 393 and 1300 px in the dark and light mode: layout, touch targets of 44 px, one primary button, one h1 in the data, empty and failed states, Select all N and Clear on tickable rows, no sideways scroll in nav, menus and tab rows, and every section, list and table inside a Pane. A look parity spec draws a sample screen in each of the six themes, dark and light, and fails when a computed colour differs from the palette in the look file. A keyboard walk checks that Down and Up reach every control in order and that the Ctrl+K palette starts in its search box. A source scan fails on window.alert, confirm and prompt (UX-4, 9, 10, 12, 15, 16, 17, 49, 51, 55, 57, 60). Cases that main fails today are test.fixme with the owning task in `ux-fixme.ts`.
