# CRSP169 report
Area: machines, jobs, images screens. Guard cases primary for /machines, /jobs, /jobs/:id, /images, /caches pass (UX_NOFIXME=1, Chromium, 360/393/1300, dark/light).
Left: primary|/machines/:id — second primary is the Pool size wizard "Review" (packages/ui part, CRSP166). Page primary Drain/Resume kept. Fixme line kept, reworded.
Note: the guard counts only `<button data-primary>`; LinkButton/ExternalButton are not counted, so primaries here are Buttons.
Touched outside area: ExportButton gets optional `kind` (packages/ui/Export.tsx).
