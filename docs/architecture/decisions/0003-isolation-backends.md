---
id: 0003-isolation-backends
title: Isolation backends as plugins behind one interface, chosen per machine and label
status: accepted
date: 2026-11-13
supersedes:
superseded_by:
type: explanation
---
# Isolation backends as plugins behind one interface, chosen per machine and label

## Context and problem

Jobs run on the user's own machines, next to the user's own work.
Machines differ: Windows with Hyper-V or WSL2, Linux with or without KVM, Macs on Apple Silicon.
A container per job shares the host kernel.
A runner that is given the Docker socket controls the host.
A VM or microVM per job isolates fully, but not every machine can start one fast.

## Options considered

1. **Containers only.**
   Pros: simple and fast.
   Cons: weak isolation; no macOS; poor for Windows desktop toolchains.
2. **VMs only.**
   Pros: full isolation.
   Cons: needs virtualization on every machine; slower starts; heavier.
3. **A backend interface with several implementations, chosen per machine and per label.**
   Pros: each machine uses the best isolation it supports.
   Cons: more code and more tests per backend.

## Decision

Option 3.
Every backend implements one interface: prepare image, start runner with a JIT config, stream logs, stop, clean up, report usage.
The agent detects which backends a machine supports and reports them.
The user allows backends per machine.
A runner can only be created on a machine whose backends support its OS and labels.

| OS | Backends, best first | Notes |
|---|---|---|
| Linux | Firecracker or Cloud Hypervisor microVM (with KVM); rootless Podman or Docker container; persistent runner | microVM per job is the default when `/dev/kvm` exists |
| Windows | Hyper-V VM; WSL2 Linux microVM or container; Windows container; persistent runner under its own service account | Jobs that need the full desktop toolchain often need a persistent runner or a VM |
| macOS | Tart VM (Apple Virtualization); persistent runner | Apple's licence allows at most two macOS VMs per Mac at once; the agent enforces it |

Rules every backend keeps:

- No privileged containers.
  KVM is passed as a device (`--device /dev/kvm`), never with `--privileged`.
- No Docker socket inside a job container.
- The console says, for every runner, which isolation it has: VM, microVM, container or persistent.
- Persistent Windows runners each run as their own local non-admin account.
  The account gets "log on as a service", is denied interactive logon, and gets "create symbolic links" only when a tool needs it.
  The runner folder is locked to that account.
- Images: a few base images per OS, with tool layers the user turns on.
  Each machine builds an image once, keeps the newest few, and pulls through a local registry mirror.
- VMs start from a snapshot taken after the first boot.

## Consequences

- Milestones add backends in order: persistent runners (1), containers on Linux and WSL2 (2), Windows service accounts and Hyper-V or WSL2 VMs (4), Tart (5), microVMs (6).
- Each backend has its own tests and its own doctor checks.
- A machine with no allowed backend for a label cannot take that label's jobs, and the console says why.
- Changes that restart runners (an image rebuild, an agent update, a new cap) drain first: they wait until the machine has no running job. The drain timeout (one per machine, default 60 minutes) only starts a warning; crsp never stops a job.
  The check for an idle machine runs right before the restart, not earlier.
