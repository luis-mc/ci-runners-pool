#!/bin/sh
# Runner hook: job started (runners R5.91, R5.93). Cleans the user's /tmp, TMPDIR
# and _work before the job; a runner that cannot clean takes no job (exit 1 fails
# the job, which can be re-run).
d=$(dirname "$0")
sh "$d/clean.sh" job-started || exit 1
state=${CRSP_STATE_DIR:-$(dirname "${CRSP_RUNNER_DIR:-/state/x}")}
mkdir -p "$state/busy" 2>/dev/null && : >"$state/busy/$(basename "${CRSP_RUNNER_DIR:-x}")" 2>/dev/null
exit 0
