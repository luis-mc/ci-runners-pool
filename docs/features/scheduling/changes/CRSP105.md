---
change: patch
task: CRSP105
---
Test only: the slot API test opens its database with `store.OpenForTests` (no disk flushes), so it no longer risks the store's 10 s deadline on a slow disk. No behaviour change.
