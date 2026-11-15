#!/bin/sh
# Wait for /dev/kvm for a bounded time, then start the command without KVM
# (handover lesson 25, machines R5.53). After a WSL or Docker restart the
# module is loaded by the kvm-loader service of compose.kvm.yaml; this script
# never loads anything and never needs a privilege.
# Usage: kvm-wait.sh <command> [args...]
# CRSP_KVM_WAIT_SECONDS bounds the wait (default 60).
set -eu
bound="${CRSP_KVM_WAIT_SECONDS:-60}"
waited=0
while [ ! -e /dev/kvm ] && [ "$waited" -lt "$bound" ]; do
  sleep 2
  waited=$((waited + 2))
done
if [ -e /dev/kvm ]; then
  export CRSP_KVM=1
else
  echo "kvm: /dev/kvm did not appear within ${bound}s; starting without KVM" >&2
  export CRSP_KVM=0
fi
exec "$@"
