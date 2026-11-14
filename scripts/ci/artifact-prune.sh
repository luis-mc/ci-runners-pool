#!/usr/bin/env bash
# Deletes every build artifact except the newest of each name.
# An artifact whose workflow run has not finished is never deleted: a later job
# of that run may still download it.
#
# Needs: gh (authenticated through GH_TOKEN), GH_REPO set to owner/repo.
# DRY_RUN=1 prints what would be deleted.
set -euo pipefail

: "${GH_REPO:?GH_REPO must be set to owner/repo}"

rows=$(gh api --paginate "repos/${GH_REPO}/actions/artifacts?per_page=100" \
  --jq '.artifacts[] | select(.expired | not) | [.id, .name, .created_at, (.workflow_run.id // 0)] | @tsv')

if [ -z "$rows" ]; then
  echo "no artifacts"
  exit 0
fi

declare -A seen run_state
deleted=0
kept=0

# Newest first, so the first row of each name is the one to keep.
while IFS=$'\t' read -r id name _created run_id; do
  if [ -z "${seen[$name]:-}" ]; then
    seen[$name]=1
    kept=$((kept + 1))
    continue
  fi
  if [ "$run_id" != "0" ]; then
    if [ -z "${run_state[$run_id]:-}" ]; then
      run_state[$run_id]=$(gh api "repos/${GH_REPO}/actions/runs/${run_id}" --jq '.status' 2>/dev/null || echo gone)
    fi
    if [ "${run_state[$run_id]}" != "completed" ] && [ "${run_state[$run_id]}" != "gone" ]; then
      echo "keep ${name} (${id}): its run ${run_id} is ${run_state[$run_id]}"
      continue
    fi
  fi
  if [ "${DRY_RUN:-0}" = "1" ]; then
    echo "would delete ${name} (${id})"
  else
    gh api -X DELETE "repos/${GH_REPO}/actions/artifacts/${id}" --silent
    echo "deleted ${name} (${id})"
  fi
  deleted=$((deleted + 1))
done < <(printf '%s\n' "$rows" | sort -t$'\t' -k3,3r)

echo "kept ${kept} newest, removed ${deleted} older"
