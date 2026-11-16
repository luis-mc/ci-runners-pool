---
change: minor
task: CRSP141
---
The parity setup writes the controller's join address (https, public host and console port) as CRSP_URL, never the address of the browser, and refuses with `needs_address` and the setting to fix when there is none; `getParityAddress` shows it and calls it from the server side (R5.84).
