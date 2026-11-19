---
change: minor
task: OPS27
---
Add runners for Linux on a Windows machine (runners R5.47). Step 1 says when the container backend is off on the machine, links to its page and disables Next with the reason. A refusal of the plan, or a plan with no step, stays on step 1 with the reason, so Review never shows an empty list. After a failure the shared wizard marks the failed step and does not tick it, the message ends with a full stop, and Try again goes back to step 1 with the reason instead of sending the same request.
