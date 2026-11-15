---
change: minor
task: RES2
---
A machine whose runner base image (container image or VM base disk) is missing is not accepting, with the new pause reason `base_image_missing`, and the doctor check `backend.baseimage` fails with the fix. The gate, the reason, the check and the probes are built; the production list of base images per backend is not wired yet (R5.74).
