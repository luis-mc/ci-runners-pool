# CRSP81 / CRSP82 / CRSP83 report (branch CRSP81-hardening-public-disk)

Status: in progress.

## CRSP81 container hardening
- Already built: cap-drop ALL, no-new-privileges, pids-limit, non-root, no host namespaces, no socket, KVM by cgroup rule.
- To do: `--read-only` root with tmpfs work dirs; guard refuses a custom seccomp profile and a writable root; spec section "What a job can reach"; tests.
- Not touched: cpuset/memory flags (HND17), mounts (HND9).

## CRSP82 public repository stop
- To do.

## CRSP83 free-disk floor
- To do.
