#!/bin/sh
# One line per persistent runner of the pool container for the agent:
#   NAME|DEPENDENCY_BYTES|UNCLEAN_REASON
# Read only (runners R5.90, R5.91). The reason comes from crsp-clean.json.
STATE=${CRSP_STATE_DIR:-/state}
DEPS=${CRSP_DEPS_DIR:-/deps}
for f in "$STATE"/runners.d/*.env; do
  [ -e "$f" ] || continue
  n=$(basename "$f" .env)
  kb=0
  [ -d "$DEPS/$n" ] && kb=$(du -sk "$DEPS/$n" 2>/dev/null | cut -f1)
  reason=
  if [ -f "$STATE/$n/crsp-clean.json" ]; then
    reason=$(sed -n 's/.*"unclean_reason":"\(\([^"\\]\|\\.\)*\)".*/\1/p' "$STATE/$n/crsp-clean.json" | head -n1 | sed 's/\\"/"/g; s/\\\\/\\/g')
  fi
  printf '%s|%s|%s\n' "$n" "$(( ${kb:-0} * 1024 ))" "$reason"
done
