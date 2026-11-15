---
change: minor
task: CRSP60
---
Packaging layers finished and extra packages built: `windows-packaging` pins the dotnet and Wine lines in its self-check, `linux-packaging` adds `fakeroot`, both are chosen by name, and the pool's extra packages are installed by a last `extra-packages` layer that is part of the image key (R5.50, R5.51). Open questions 32 to 34.
