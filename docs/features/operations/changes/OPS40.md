---
change: minor
task: OPS40
---
Release installers and archives carry the version in their name (owner decision D108, DL-96): `crsp-windows-amd64_0.1.15.msi`, and the same for the arm64 MSI, the pkg, deb, rpm, tar.gz and zip files, with the same names in `SHA256SUMS` and in the attestation subjects. The version has no leading `v`. Only release assets change; CI artifacts keep stable names. The updater looks for the versioned name first and the plain name second, so it still installs a release up to 0.1.14. New R5.119. Machines on 0.1.14 or older keep looking for the plain name, so they install the first versioned release by hand once.
