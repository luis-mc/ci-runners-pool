---
change: minor
task: HND1
---
The pool gets KVM through the cgroup rule `c 10:232 rwm` instead of a `/dev/kvm` device mapping, and `kvm-wait.sh` creates the node with mknod once /proc/misc lists kvm, so the pool starts at Docker's boot before the KVM loader (handover lesson 28). Requirement R5.41; machines R5.53.
