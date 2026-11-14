#!/bin/sh
# CRSP runner hook: job completed (runners R5.22, R5.23).
crsp=/usr/local/bin/crsp
if [ ! -x "$crsp" ]; then
  echo "crsp hook: $crsp is not installed; the job goes on."
  exit 0
fi
exec "$crsp" hook job-completed
