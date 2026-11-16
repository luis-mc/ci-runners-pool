# CRSP110 report

Task: github-integration R6.10 (data kept) and R6.11 (limits). Branch CRSP110-data-limits.

## Found
- `users`: github_user_id, login, role, added_by, added_at, last_sign_in_at. Only the R6.10 fields. No migration needed.
- `sessions`: id_hash, github_user_id, csrf_hash, source, created_at, last_seen_at, ended_at. Hash only, no raw id.
- Listing already follows Link rel=next at per_page=100 (`getAll`); the API already pages with a cursor.
- A 1,050-repository test existed for the user listing (no page-count check, none for the installation-token listing, none over the API).

## Plan
1. Tests: fake GitHub 1,100 repos over 11 pages (both listings), API paging over 1,000+, store test of the column set.
2. Inventory rows in stack-profile section 7.
3. Spec R6.10 and R6.11 marked built (text only), change note CRSP110.

## Status
(updated below as steps finish)
