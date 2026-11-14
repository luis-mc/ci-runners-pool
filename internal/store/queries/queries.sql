-- name: SetMeta :exec
INSERT INTO schema_meta (key, value) VALUES (?, ?)
ON CONFLICT (key) DO UPDATE SET value = excluded.value,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- name: GetMeta :one
SELECT value FROM schema_meta WHERE key = ?;

-- name: InsertAuditEntry :one
INSERT INTO audit_log (actor, action, subject, detail) VALUES (?, ?, ?, ?)
RETURNING id;

-- name: EnqueueJob :one
INSERT INTO job_queue (kind, payload, dedupe_id) VALUES (?, ?, ?)
ON CONFLICT (dedupe_id) DO UPDATE SET dedupe_id = excluded.dedupe_id
RETURNING id;

-- name: CountJobsByState :one
SELECT count(*) FROM job_queue WHERE state = ?;
