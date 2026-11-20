-- The Job page faults (CIX8 contract, docs/features/ci-run-insights R5.39 to R5.41): who ran a job, where its
-- steps came from, and the reconcile of rows that look stale.

-- name: SetJobRunnerOrigin :exec
UPDATE jobs SET runner_origin = ?, runner_group = ?, runner_labels = ? WHERE id = ?;

-- name: SetJobStepsSource :exec
UPDATE jobs SET steps_source = ? WHERE id = ?;

-- name: SetJobCheckedAt :exec
UPDATE jobs SET checked_at = ? WHERE id = ?;

-- name: ListStaleJobRuns :many
SELECT repository_id, repository, run_id, run_attempt, CAST(MIN(updated_at) AS TEXT) AS oldest_update
FROM jobs
WHERE state IN ('queued', 'running') AND updated_at < ? AND (checked_at = '' OR checked_at < ?)
GROUP BY repository_id, repository, run_id, run_attempt
ORDER BY oldest_update
LIMIT ?;
