---
change: minor
task: CRSP65
---
`crsp vm prepare`, `crsp vm run` and `crsp vm selinux`: a per-run ssh key (mode 0600, deleted at the end, never logged) and cloud-init seed, the package copied in over scp, install and check commands over ssh with a timeout and the first failing command's exit code, and the SELinux checks (Enforcing, rpm, module, service context, no AVC) (R5.46 in part; open questions 17 and 18).
