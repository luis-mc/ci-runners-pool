#!/bin/sh
# Runner hook: job completed (runners R5.91, R5.93). Cleans the user's /tmp,
# TMPDIR and _work after the job. It never fails a job that already finished; a
# clean-up that fails leaves the runner unclean (crsp-clean.json) and the next
# job-started waits for it.
d=$(dirname "$0")
state=${CRSP_STATE_DIR:-$(dirname "${CRSP_RUNNER_DIR:-/state/x}")}
sh "$d/clean.sh" job-completed
rm -f "$state/busy/$(basename "${CRSP_RUNNER_DIR:-x}")" 2>/dev/null
exit 0
