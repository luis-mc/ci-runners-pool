---
change: minor
task: OPS46
---
Container engine is found on first use, so Linux container runners start and Remove cleans up with no prior Detect (R5.47); the engine reason replaces 'no usable container engine'; clean-up with no engine succeeds and says 'container', not 'service'; a failed Windows folder reset error carries its step, exit code and message (R5.58).
