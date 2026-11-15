#!/bin/sh
# Wait for KVM for a bounded time, then start the command without KVM
# (handover lessons 25 and 28, machines R5.53). After a WSL or Docker restart
# the module is loaded by the kvm-loader service of compose.kvm.yaml. The pool
# container is never given /dev/kvm as a device (a missing device fails the
# container start at daemon boot); it gets the cgroup rule 'c 10:232 rwm'
# instead, and this script creates the node with mknod once /proc/misc lists
# kvm. It never loads a module and never needs a privilege beyond mknod; when
# mknod is refused the pool starts without KVM and says so.
# Usage: kvm-wait.sh <command> [args...]
# CRSP_KVM_WAIT_SECONDS bounds the wait (default 60). CRSP_KVM_DEV, CRSP_PROC_MISC
# and CRSP_KVM_GID default to /dev/kvm, /proc/misc and none; tests change them.
set -eu
bound="${CRSP_KVM_WAIT_SECONDS:-60}"
dev="${CRSP_KVM_DEV:-/dev/kvm}"
misc="${CRSP_PROC_MISC:-/proc/misc}"
step="${CRSP_KVM_STEP_SECONDS:-2}"

# Prints the minor number of kvm in /proc/misc, or nothing.
kvm_minor() {
  [ -r "$misc" ] || return 0
  while read -r minor name; do
    if [ "$name" = "kvm" ]; then
      echo "$minor"
      return 0
    fi
  done <"$misc"
}

make_node() {
  minor="$(kvm_minor)"
  [ -n "$minor" ] || return 1
  mknod -m 0660 "$dev" c 10 "$minor" 2>/dev/null || return 1
  if [ -n "${CRSP_KVM_GID:-}" ]; then
    chgrp "$CRSP_KVM_GID" "$dev" 2>/dev/null || echo "kvm: chgrp $CRSP_KVM_GID $dev failed" >&2
  fi
  return 0
}

waited=0
refused=0
while [ ! -e "$dev" ]; do
  # mknod once the host lists kvm; a refusal is logged once, the wait goes on.
  if [ -n "$(kvm_minor)" ] && ! make_node; then
    if [ "$refused" -eq 0 ]; then
      echo "kvm: cannot create $dev; waiting for it to appear" >&2
      refused=1
    fi
  fi
  [ -e "$dev" ] && break
  [ "$waited" -lt "$bound" ] || break
  sleep "$step"
  waited=$((waited + step))
done
if [ -e "$dev" ]; then
  export CRSP_KVM=1
else
  echo "kvm: /dev/kvm did not appear within ${bound}s; starting without KVM" >&2
  export CRSP_KVM=0
fi
exec "$@"
