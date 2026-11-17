---
change: minor
task: LOOK12
---
The Images tab shows what each image holds. A card now shows for every machine that can run container jobs, also before the first build ("Not built yet. Choose layers now; it is built when the first runner starts."), and ticks and Save work then; Rebuild waits for a build. The card lists the base tools with versions, the extra packages per repository, and the optional layers as a table with what each adds, when to pick it, which repositories need it (amber when jobs fail without it) and its size. The image resource gains `base_tools`, `extra_packages`, and per layer `adds`, `purpose` and `needed_by`; the state `not_built` is new. `failing` stays 0 until job failures can be read (R5.55, open question Q22).
