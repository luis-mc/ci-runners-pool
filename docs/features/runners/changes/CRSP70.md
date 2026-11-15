---
change: minor
task: CRSP70
---
A repository pool has extra distribution packages the owner sets without editing files: a policy field, `GET` and `PUT /api/v1/repositories/{id}/extra-packages` (validated with `ParseExtraPackages`, a bad name answers with its line number), `crsp repo packages OWNER/NAME [--set A,B]`, and the names are part of the image key, so a changed list builds a new image aside (R5.51). Not built: the list over the agent link to a remote machine (open question 48).
