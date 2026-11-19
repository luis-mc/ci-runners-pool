-- Registry records (REG4 owns this file; docs/features/registry R5.5): image reads, layers, pulls, pushes,
-- per-day totals.

-- name: GetRegistryImage :one
SELECT * FROM registry_images WHERE id = ?;

-- name: GetPromotedRegistryImageByKey :one
SELECT * FROM registry_images
WHERE image_tag = ? AND arch = ? AND state IN ('current', 'variant', 'superseded')
ORDER BY promoted_at DESC LIMIT 1;

-- name: ListRegistryImages :many
SELECT * FROM registry_images
WHERE (CAST(sqlc.arg(kind) AS TEXT) = '' OR kind = sqlc.arg(kind))
  AND (CAST(sqlc.arg(state) AS TEXT) = '' OR state = sqlc.arg(state))
  AND (CAST(sqlc.arg(arch) AS TEXT) = '' OR arch = sqlc.arg(arch))
  AND (CAST(sqlc.arg(profile_id) AS TEXT) = '' OR profile_id = sqlc.arg(profile_id))
  AND state <> 'deleted'
ORDER BY promoted_at DESC, id;

-- name: SetRegistryImageSizes :exec
UPDATE registry_images SET size_bytes = ?, unique_bytes = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE id = ?;

-- name: SetRegistryImageLastPull :exec
UPDATE registry_images SET last_pull_at = ? WHERE id = ? AND last_pull_at < ?;

-- name: UpsertRegistryLayer :exec
INSERT INTO registry_layers (digest, size_bytes, media_type, charged_to) VALUES (?, ?, ?, ?)
ON CONFLICT (digest) DO NOTHING;

-- name: InsertRegistryImageLayer :exec
INSERT INTO registry_image_layers (image_id, layer_digest, position) VALUES (?, ?, ?)
ON CONFLICT (image_id, layer_digest) DO NOTHING;

-- name: ListRegistryImageLayers :many
SELECT l.digest, l.size_bytes, l.media_type, l.charged_to, il.position,
       (SELECT count(*) FROM registry_image_layers o WHERE o.layer_digest = l.digest) AS holders
FROM registry_image_layers il JOIN registry_layers l ON l.digest = il.layer_digest
WHERE il.image_id = ?
ORDER BY il.position;

-- name: SumRegistryLayersByKind :many
SELECT charged_to, sum(size_bytes) AS bytes FROM registry_layers GROUP BY charged_to;

-- name: UpsertRegistryPull :exec
INSERT INTO registry_pulls (pull_id, machine_id, image_id, image_tag, manifest_digest, source, state, bytes_done,
    bytes_total, seconds, saved_seconds, repository, job_id, error, started_at, finished_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (pull_id) DO UPDATE SET
    state = excluded.state, bytes_done = excluded.bytes_done, bytes_total = excluded.bytes_total,
    seconds = excluded.seconds, saved_seconds = excluded.saved_seconds, error = excluded.error,
    finished_at = excluded.finished_at, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- name: ListRegistryPullsInFlight :many
SELECT * FROM registry_pulls WHERE state IN ('pulling', 'waiting_controller') ORDER BY started_at;

-- name: ListRegistryImageMachines :many
SELECT machine_id, max(finished_at) AS last_at, count(*) AS uses
FROM registry_pulls WHERE image_id = ? AND state = 'done'
GROUP BY machine_id ORDER BY last_at DESC;

-- name: AddRegistryPullDaily :exec
INSERT INTO registry_pull_daily (image_id, day, pulls, builds_saved, saved_seconds) VALUES (?, ?, 1, ?, ?)
ON CONFLICT (image_id, day) DO UPDATE SET
    pulls = pulls + 1, builds_saved = builds_saved + excluded.builds_saved,
    saved_seconds = saved_seconds + excluded.saved_seconds;

-- name: ListRegistryPullDaily :many
SELECT * FROM registry_pull_daily WHERE image_id = ? AND day >= ? ORDER BY day;

-- name: SumRegistryPullDailySince :one
SELECT coalesce(sum(pulls), 0) AS pulls, coalesce(sum(builds_saved), 0) AS builds_saved,
       coalesce(sum(saved_seconds), 0.0) AS saved_seconds
FROM registry_pull_daily WHERE day >= ?;

-- name: DeleteOldRegistryPulls :execrows
DELETE FROM registry_pulls WHERE started_at < ? AND state IN ('done', 'failed');

-- name: DeleteOldRegistryPullDaily :execrows
DELETE FROM registry_pull_daily WHERE day < ?;

-- name: UpsertRegistryPush :exec
INSERT INTO registry_pushes (push_id, machine_id, image_tag, staged_name, target_name, manifest_digest, state,
    image_id, seconds, error, started_at, finished_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (push_id) DO UPDATE SET
    manifest_digest = excluded.manifest_digest, state = excluded.state, image_id = excluded.image_id,
    seconds = excluded.seconds, error = excluded.error, finished_at = excluded.finished_at,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- name: ListRegistryPushesInFlight :many
SELECT * FROM registry_pushes WHERE state IN ('pushing', 'waiting_controller', 'pushed') ORDER BY started_at;
