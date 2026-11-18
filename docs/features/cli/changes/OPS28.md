---
change: minor
task: OPS28
---
Adds R5.62 (owner decisions D93, D94, D95, 18 Nov 2026): `runner create` gains `--ephemeral` and `--keep-dependencies` or `--no-keep-dependencies` for pool runners and keeps `--persistent`; `runner update` changes the dependency setting; `runner clear-cache` clears a runner's own dependency folder; `repo policy --runner-kind ephemeral-only|any-runner` sets the per-repository kind, and `repo list` and `runner list` show the kind, the setting, the cache size and an unclean runner. The CLI makes the same choices and asks the same question as the console, so nothing is console-only.
