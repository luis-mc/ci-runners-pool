---
change: minor
task: LOOK29
---
Repositories lists Repository, Pool, Jobs go to and Last delivery; under each name a muted line (for example `2 parallel · priority 0 · variables ok`); Visibility is a tag only when not Private; labels, parallel jobs, priority and variables stay editable on the repository page. No horizontal scroll bar anywhere (UX-49 changed): `.ds-table-frame` no longer scrolls, and the e2e layout check fails any scroll bar at 360, 393, 1300 and 1800 px.
