---
change: minor
task: IMG2
---
Stack scan built: stackscan reads the stack files of a repository at the run's commit through the GitHub tree and contents calls, LF-normalised, cached by commit, delayed on a low rate budget, and hands REG3 the file list (registry.StackSource); a file over 1 MiB is hashed by its blob sha.
