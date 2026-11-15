---
change: minor
task: CRSP66
---
The Wine prefix of a cache lane is made once and kept: it is made on the first job of an image with the `windows-packaging` layer, a stamp file records the Wine line, and the prefix is rebuilt only when the line changes (R5.52). The job sees it as `WINEPREFIX` and `POOL_WINE_PREFIX`. The pool start does not call it yet. Open question 47.
