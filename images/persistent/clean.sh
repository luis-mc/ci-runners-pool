#!/bin/sh
# Always-clean rule of a persistent Linux runner in the pool container (runners
# R5.91, R5.93). The hooks job-started.sh and job-completed.sh call it, so the
# temporary files of a job are removed after every job and again right before
# the next one. It is not a setting. Only the dependencies in $CRSP_DEPS are a
# choice: they stay while crsp-hygiene.env says CRSP_KEEP_DEPENDENCIES=1 and are
# removed after every job when it says 0 (runners R5.90). The setting is read
# from the env file the agent writes in the runner folder; no token is read.
#
#   clean.sh job-started|job-completed
#
# Exit 0: clean. Exit 1: something stays; the reason is in crsp-clean.json and
# on standard output. job-started retries every CRSP_CLEAN_POLL seconds for
# CRSP_CLEAN_MAX_WAIT seconds before it gives up, so a runner that cannot clean
# takes no job.
phase=${1:-job-completed}
dir=${CRSP_RUNNER_DIR:-}
if [ -z "$dir" ] || [ ! -d "$dir" ]; then
  echo "crsp clean: CRSP_RUNNER_DIR is not set to a runner folder"
  exit 0
fi
name=$(basename "$dir")
state=${CRSP_STATE_DIR:-$(dirname "$dir")}
deps=${CRSP_DEPS:-/deps/$name}
work=$dir/_work
poll=${CRSP_CLEAN_POLL:-30}
maxwait=${CRSP_CLEAN_MAX_WAIT:-600}
me=$(id -u)

keep=1
if [ -f "$dir/crsp-hygiene.env" ] && grep -q '^CRSP_KEEP_DEPENDENCIES=\(0\|false\|off\|no\)' "$dir/crsp-hygiene.env"; then
  keep=0
fi

failed=""
removed=0
fail() { failed="${failed:+$failed; }$1"; }

# rm_path removes one path and records what stays.
rm_path() {
  rm -rf -- "$1" 2>/dev/null
  if [ -e "$1" ] || [ -L "$1" ]; then
    fail "$1"
  else
    removed=$((removed + 1))
  fi
}

# empty_dir removes everything inside $1 (the folder stays). Names after the
# first argument are skipped.
empty_dir() {
  d=$1; shift
  [ -d "$d" ] || return 0
  for e in "$d"/* "$d"/.[!.]* "$d"/..?*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    b=$(basename "$e")
    skip=0
    for s in "$@"; do [ "$b" = "$s" ] && skip=1; done
    [ "$skip" = 1 ] && continue
    rm_path "$e"
  done
}

# 4. processes the job left running: the processes of this runner's own session
# that are not the hook's ancestors and not the runner itself.
end_processes() {
  mysid=
  keepers=" $$ "
  p=$$
  n=0
  while [ "$n" -lt 64 ] && [ -r "/proc/$p/stat" ]; do
    st=$(cat "/proc/$p/stat" 2>/dev/null) || break
    rest=${st##*) }
    set -- $rest
    [ -z "$mysid" ] && mysid=$4
    p=$2
    [ "$p" -gt 0 ] 2>/dev/null || break
    keepers="$keepers$p "
    n=$((n + 1))
  done
  [ -n "$mysid" ] || return 0
  for pd in /proc/[0-9]*; do
    pid=${pd#/proc/}
    case "$keepers" in *" $pid "*) continue ;; esac
    [ "$(stat -c %u "$pd" 2>/dev/null)" = "$me" ] || continue
    st=$(cat "$pd/stat" 2>/dev/null) || continue
    comm=${st#*(}; comm=${comm%)*}
    rest=${st##*) }
    set -- $rest
    [ "$4" = "$mysid" ] || continue
    case "$comm" in Runner.Listener|Runner.Worker|run.sh|runsvc.sh|run-helper.sh) continue ;; esac
    kill -9 "$pid" 2>/dev/null
    sleep 0.1 2>/dev/null
    if [ -d "$pd" ] && [ "$(sed -n 's/^State:[[:space:]]*\(.\).*/\1/p' "$pd/status" 2>/dev/null)" != "Z" ]; then
      fail "the process $comm ($pid), which will not end"
    else
      removed=$((removed + 1))
    fi
  done
}

# busy_peers is true when another runner of this container has a job: the shared
# /tmp is then left to the quiet moment, because it is one folder for all of them.
busy_peers() {
  for b in "$state"/busy/*; do
    [ -e "$b" ] || continue
    [ "$(basename "$b")" = "$name" ] || return 0
  done
  return 1
}

one_pass() {
  failed=""
  removed=0
  end_processes
  # 1. the _work workspace. The folder the runner made for the job that starts is
  # emptied and stays; the runner's own files for it stay.
  protect="_PipelineMapping"
  [ "$keep" = 1 ] && protect="$protect _actions _tool"
  for e in "$work"/* "$work"/.[!.]*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    b=$(basename "$e")
    case " $protect " in *" $b "*) continue ;; esac
    if [ "$b" = "_temp" ]; then
      if [ "$phase" = job-started ]; then
        empty_dir "$e" _runner_file_commands _github_workflow _github_home
      else
        empty_dir "$e"
      fi
      continue
    fi
    if [ "$phase" = job-started ] && [ -n "$GITHUB_WORKSPACE" ]; then
      case "$GITHUB_WORKSPACE/" in
        "$e"/*) empty_dir "$e"; [ -d "$GITHUB_WORKSPACE" ] && empty_dir "$GITHUB_WORKSPACE"; continue ;;
      esac
    fi
    rm_path "$e"
  done
  # 2. the temp folder of the runner (TMPDIR and RUNNER_TEMP).
  [ -n "$TMPDIR" ] && [ "$TMPDIR" != / ] && [ "$TMPDIR" != /tmp ] && empty_dir "$TMPDIR"
  if [ -n "$RUNNER_TEMP" ] && [ "$RUNNER_TEMP" != "$work/_temp" ] && [ "$RUNNER_TEMP" != / ] && [ "$RUNNER_TEMP" != /tmp ]; then
    empty_dir "$RUNNER_TEMP"
  fi
  # 3. the entries of /tmp that the runner user owns (the runners of one
  # container share this user, so only while no other runner has a job).
  if ! busy_peers; then
    for e in /tmp/* /tmp/.[!.]*; do
      [ -e "$e" ] || [ -L "$e" ] || continue
      [ "$(stat -c %u "$e" 2>/dev/null)" = "$me" ] || continue
      case "$(basename "$e")" in .X11-unix|crsp-*|.dotnet|.net) continue ;; esac
      [ -S "$e" ] || [ -p "$e" ] && continue
      rm_path "$e"
    done
  fi
  # The dependencies: kept while the setting is on.
  if [ "$keep" = 0 ]; then
    empty_dir "$deps"
    rm_path "$work/_actions"
    rm_path "$work/_tool"
  fi
}

json_escape() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr '\n' ' '; }

write_state() {
  reason=$1
  tmp="$dir/crsp-clean.json.$$"
  printf '{"unclean_reason":"%s","at":"%s","phase":"%s"}\n' "$(json_escape "$reason")" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$phase" >"$tmp" 2>/dev/null &&
    mv -f "$tmp" "$dir/crsp-clean.json" 2>/dev/null
}

waited=0
while :; do
  one_pass
  if [ -z "$failed" ]; then
    write_state ""
    echo "crsp clean ($phase): removed $removed entries, dependencies $([ "$keep" = 1 ] && echo kept || echo removed)"
    exit 0
  fi
  reason="the clean-up of the last job left $failed in place"
  write_state "$reason"
  echo "::warning title=crsp::this runner is not clean ($reason), so it takes no job until it is"
  if [ "$phase" != job-started ] || [ "$waited" -ge "$maxwait" ]; then
    exit 1
  fi
  sleep "$poll"
  waited=$((waited + poll))
  [ "$poll" -gt 0 ] || waited=$maxwait
done
