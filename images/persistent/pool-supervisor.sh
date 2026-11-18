#!/bin/sh
# Supervisor of the persistent Linux pool container (runners R5.93). It runs one
# runner for every file in $STATE/runners.d, each in its own session, and starts
# a dead runner again with back-off (2, 4, 8 ... 60 seconds; the count starts
# over after the runner stayed up for five minutes). A runner whose file is gone
# or has a `.stopped` marker is ended. The runners register with
# `config.sh --unattended --replace` (never --ephemeral) when they are added by
# add-runner.sh, so a restart only runs them.
STATE=${CRSP_STATE_DIR:-/state}
DEPS=${CRSP_DEPS_DIR:-/deps}
RUN=${CRSP_SUPERVISOR_RUN:-/tmp/crsp-supervisor}
TICK=${CRSP_SUPERVISOR_TICK:-5}
BIN=$STATE/bin
mkdir -p "$RUN" "$STATE/busy"

now() { date +%s; }

# runner_env prints the environment of one runner as `env` arguments.
start_runner() {
  n=$1
  dir=$STATE/$n
  [ -x "$dir/run.sh" ] || return 1
  mkdir -p "$DEPS/$n" "/tmp/crsp-run-$n" "$dir/_work/_temp"
  (
    cd "$dir" || exit 1
    export CRSP_RUNNER_DIR=$dir CRSP_STATE_DIR=$STATE CRSP_DEPS=$DEPS/$n
    export TMPDIR=/tmp/crsp-run-$n
    export RUNNER_TOOL_CACHE=$DEPS/$n/tools AGENT_TOOLSDIRECTORY=$DEPS/$n/tools CI_TOOLS_DIR=$DEPS/$n/tools
    export npm_config_cache=$DEPS/$n/npm npm_config_store_dir=$DEPS/$n/pnpm-store
    export GOMODCACHE=$DEPS/$n/go/mod GOCACHE=$DEPS/$n/go/build CARGO_HOME=$DEPS/$n/tools/cargo
    export PIP_CACHE_DIR=$DEPS/$n/pip PLAYWRIGHT_BROWSERS_PATH=$DEPS/$n/playwright
    export ACTIONS_RUNNER_HOOK_JOB_STARTED=$BIN/job-started.sh ACTIONS_RUNNER_HOOK_JOB_COMPLETED=$BIN/job-completed.sh
    [ -f "$STATE/runners.d/$n.env" ] && . "$STATE/runners.d/$n.env"
    exec setsid ./run.sh
  ) >>"$dir/runner.log" 2>&1 &
  echo $! >"$RUN/$n.pid"
  now >"$RUN/$n.since"
}

alive() { [ -f "$RUN/$1.pid" ] && kill -0 "$(cat "$RUN/$1.pid")" 2>/dev/null; }

end_runner() {
  [ -f "$RUN/$1.pid" ] || return 0
  p=$(cat "$RUN/$1.pid")
  # the runner's own session: the setsid child and everything it started
  kill -TERM -- "-$p" 2>/dev/null || kill -TERM "$p" 2>/dev/null
  rm -f "$RUN/$1.pid" "$RUN/$1.since"
}

backoff_for() {
  c=0
  [ -f "$RUN/$1.fails" ] && c=$(cat "$RUN/$1.fails")
  d=2
  i=0
  while [ "$i" -lt "$c" ] && [ "$d" -lt 60 ]; do d=$((d * 2)); i=$((i + 1)); done
  [ "$d" -gt 60 ] && d=60
  echo "$d"
}

tick() {
  for f in "$STATE"/runners.d/*.env; do
    [ -e "$f" ] || continue
    n=$(basename "$f" .env)
    if [ -e "$STATE/runners.d/$n.stopped" ]; then
      end_runner "$n"
      continue
    fi
    if alive "$n"; then
      since=$(cat "$RUN/$n.since" 2>/dev/null || now)
      [ $(($(now) - since)) -ge 300 ] && rm -f "$RUN/$n.fails"
      continue
    fi
    # dead, or never started: wait out the back-off, then start it again
    if [ -f "$RUN/$n.next" ] && [ "$(now)" -lt "$(cat "$RUN/$n.next")" ]; then
      continue
    fi
    if [ -f "$RUN/$n.pid" ]; then
      c=0
      [ -f "$RUN/$n.fails" ] && c=$(cat "$RUN/$n.fails")
      echo $((c + 1)) >"$RUN/$n.fails"
      echo "crsp supervisor: runner $n ended, starting it again in $(backoff_for "$n") s"
      echo $(($(now) + $(backoff_for "$n"))) >"$RUN/$n.next"
      rm -f "$RUN/$n.pid"
      continue
    fi
    echo "crsp supervisor: starting runner $n"
    start_runner "$n" || echo "crsp supervisor: runner $n has no files yet"
  done
  # a runner whose file is gone
  for p in "$RUN"/*.pid; do
    [ -e "$p" ] || continue
    n=$(basename "$p" .pid)
    [ -e "$STATE/runners.d/$n.env" ] || end_runner "$n"
  done
}

term() { for p in "$RUN"/*.pid; do [ -e "$p" ] && end_runner "$(basename "$p" .pid)"; done; exit 0; }
trap term TERM INT

[ -n "$CRSP_SUPERVISOR_ONCE" ] && { tick; exit 0; }
while :; do
  tick
  sleep "$TICK" &
  wait $!
done
