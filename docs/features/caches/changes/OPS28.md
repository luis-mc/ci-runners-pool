---
change: minor
task: OPS28
---
Adds R5.56, the per-runner dependency cache (owner decision D95, 18 Nov 2026). A persistent runner keeps its downloaded dependencies in its own folder, never shared with another runner, only while its setting Keep downloaded dependencies is on; Images and caches counts the folder and offers Clear now. Reasoning: dependencies are public downloads that speed up later runs and carry none of a job's own data, so keeping them is a per-runner choice; the temporary files of a job are never part of this cache and are always removed (runners R5.91). The shared caches of R5.37 are unchanged.
