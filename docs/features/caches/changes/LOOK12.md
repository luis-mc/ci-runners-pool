---
change: minor
task: LOOK12
---
The Images tab is a simple list: one row per image with one status line (amber when a repository needs a layer the image lacks, "Not built yet", or "Has what its repositories need") and "<n> extra layers" or "base only"; a row opens the image on its own screen (`/images/:imageId`). There the layers are a plain check list with a one-line purpose and "needed by N", an amber banner with "Add it" for missing layers, one primary "Save and rebuild" ("Save" before the first build) with Cancel, and a folded "What is inside this image" with the base tools, the extra packages per repository and a plain Rebuild. The image resource keeps `base_tools`, `extra_packages`, and per layer `adds`, `purpose` and `needed_by`; the state `not_built` stays (R5.55, owner decision LOOK D23).
