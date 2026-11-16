# CRSP121 report
- internal/api/handlers_auth.go: first_machine = done when machines List non-empty (any state); first_repository uses new repos.AnyPoolOn (store only; old path went through view(), whose errors were swallowed). Errors logged.
- apps/web Shell.tsx: header PoolStatus reads GET /api/v1/machines (was live overview); setup state refetched on machines/repositories versions and route change; banner hidden when all done.
- Tests: internal/api/setupstate_test.go; Shell.test.tsx (4 new).
- Docs: change notes web-console, github-integration (docs_fold.py not available in sandbox, notes written by hand). No new words, content.md unchanged.
- Pre-existing failures on main: AuditLog and ConfigExport Vitest (Blob.text).
