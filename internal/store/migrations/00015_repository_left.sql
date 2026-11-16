-- +goose Up
-- CRSP125: a repository that left its installation is kept, marked, and hidden
-- from listings; the repositories screen shows why from left_at.
ALTER TABLE repositories ADD COLUMN left_at TEXT;

-- +goose Down
ALTER TABLE repositories DROP COLUMN left_at;
