---
change: minor
task: OPS28
---
Adds R5.101 and R5.102 and the screen text of Repositories, Runners and Images and caches (owner decisions D93, D94, D95, 18 Nov 2026). Add runners step 1 has the Kind choice with a reason line for the default, offers only kinds the machine can run and says why another is not offered, asks Keep downloaded dependencies for a persistent runner and always says "Temporary files of each job are always removed." because cleaning is a rule of the pool and not a choice. The Runners list and runner page show the kind, the dependency setting, its size, Clear now and an unclean runner with its reason. The Repositories page shows the Runner kind column (Ephemeral only or Any runner), the setting, a question before a public repository is set to Any runner, and the state No ephemeral capacity with a link to Add runners. No design-system rule or component changed; new words are in design-system next-version content.
