---
change: minor
task: RES2
---
A machine whose runner base image (container image or VM base disk) is missing reports not accepting with the new pause reason `base_image_missing`; new jobs are held, a running job is not cut (runners R5.69). The production list of base images is not wired yet.
