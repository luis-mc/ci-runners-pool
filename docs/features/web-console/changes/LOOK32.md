---
change: minor
task: LOOK32
---
The machine page header keeps Stop new jobs and Resume at the right edge. The shared page header (component 1) takes a `hint`: one muted line, right-aligned under the action, in the same slot, which is at most 22 rem wide and so is never widened by the hint. Stop new jobs and Resume both use it with a hint of one length, so the header has the same height in both states and the Facts box no longer moves up after the question card. At phone width the slot is full width and the hint reads from the left. UX-3 and UX-4 apply to every page that has a header action; the other pages with one (Repository detail, state pages) already pass a button only and take the new alignment from the same part, with no app CSS. A DOM test measures the machine page at 360, 393 and 1300 px in both states; a unit test checks the slot has one shape in both states.
