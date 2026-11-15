---
change: minor
task: CRSP75
---
A machine has a mode (Automatic, Always, Paused), a battery pause switch (on by default) and a CPU cap for runner processes (25, 50, 75, 100%). The machine status gets `Accepting` and `PauseReason` (paused, on_battery, quiet_hours, budget), reported by the agent over the existing link. Battery is read per OS (unknown counts as mains). New requirements R5.60 to R5.63; quiet hours (R5.28) stay as specified and are not built.
