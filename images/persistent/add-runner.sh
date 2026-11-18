#!/bin/sh
# Adds one persistent runner to the pool container (runners R5.93):
#   add-runner.sh NAME URL LABELS GROUP KEEP   (the registration token on standard input)
# The runner folder is a copy of the runner in the image, kept in the state
# volume so the registration survives a restart of the container. It registers
# with `config.sh --unattended --replace` and never with --ephemeral. The token
# is read from standard input and passed to that one process in its environment
# only: it is in no file, no argument and no container setting (runners R6.2).
name=$1 url=$2 labels=$3 group=$4 keep=${5:-1}
STATE=${CRSP_STATE_DIR:-/state}
SRC=${CRSP_RUNNER_SRC:-/opt/actions-runner}
case "$name" in *[!A-Za-z0-9._-]* | "" | .*) echo "runner name $name cannot be used" >&2; exit 2 ;; esac
IFS= read -r token || exit 1
[ -n "$token" ] || exit 1
dir=$STATE/$name
mkdir -p "$STATE/runners.d" "$STATE/busy" || exit 1
if [ ! -x "$dir/config.sh" ]; then
  mkdir -p "$dir" && cp -a "$SRC/." "$dir/" || { rm -rf "$dir"; exit 1; }
fi
set -- --unattended --replace --url "$url" --name "$name" --labels "$labels" --disableupdate --work _work
[ -n "$group" ] && set -- "$@" --runnergroup "$group"
if ! (cd "$dir" && ACTIONS_RUNNER_INPUT_TOKEN="$token" ./config.sh "$@"); then
  rm -rf "$dir"
  exit 1
fi
if [ "$keep" = 0 ]; then k=0; else k=1; fi
printf 'CRSP_KEEP_DEPENDENCIES=%s\n' "$k" >"$dir/crsp-hygiene.env"
rm -f "$STATE/runners.d/$name.stopped"
: >"$STATE/runners.d/$name.env"
