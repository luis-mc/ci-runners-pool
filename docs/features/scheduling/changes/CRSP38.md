---
change: minor
task: CRSP38
---
Hooks turn prompts off (GIT_TERMINAL_PROMPT=0, GCM_INTERACTIVE=never), call the agent with a 5 s limit, fail open with a warning, cancel a queued ticket when the agent goes, and write each decision before the slow step; a runner drain logs its steps; an operation waits only for the runners it touches (R5.62 to R5.64).
