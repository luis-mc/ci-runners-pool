---
change: minor
task: HND6
---
The runner record keeps its route (pool and queue) apart from its name; routing never parses a name, and migration 13 derives the route of existing records once (R5.68).
