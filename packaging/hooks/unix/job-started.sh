#!/bin/sh
# CRSP runner hook: job started (runners R5.22, R5.23, R5.39).
# A crsp that is missing or broken never fails the job, but it is never silent:
# the job gets a ::warning annotation and the runner folder gets a problem file
# that the doctor reads (scheduling R5.60).
hook=job-started
crsp=${CRSP_BIN:-/usr/local/bin/crsp}
dir=$(dirname "$0")
warn() {
  echo "::warning title=crsp::$1"
  echo "$hook: $1" > "$dir/crsp-hook-problem.txt" 2>/dev/null
  exit 0
}
if [ ! -x "$crsp" ]; then
  warn "crsp is not installed at $crsp, so this job ran without the queue and the load gate. Reinstall crsp for all users on this machine, then run 'crsp doctor --check runner.hooks'. The job was not stopped."
fi
CRSP_HOOK_DIR=$dir
export CRSP_HOOK_DIR
"$crsp" hook "$hook" "$@"
code=$?
if [ "$code" -eq 126 ] || [ "$code" -eq 127 ]; then
  warn "crsp at $crsp could not run (exit $code), so this job ran without the queue and the load gate. Reinstall crsp for all users on this machine, then run 'crsp doctor --check runner.hooks'. The job was not stopped."
fi
exit "$code"
