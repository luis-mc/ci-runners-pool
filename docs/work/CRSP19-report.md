# CRSP19 report

Status: in progress. Done and pushed: secrets, github client + fake, auth, repos (all tested). Next: api handlers, docs notes, checks, PR.

## Design
- Data access goes through ports declared in `internal/auth` and `internal/repos` (api may not import store; CRSP18 owns store). Each package ships an in-memory implementation for tests. The sqlc-backed adapter belongs with the store (CRSP18) or the integration join.
- GitHub adapter uses net/http only (no go-github), App JWT RS256 from stdlib.
- Fake GitHub server: `internal/github/fake` (brief name; spec says githubfake).

## Steps
1. secrets (file 0600, memory, OS stores by build tag) - pending
2. github client + fake - pending
3. auth - pending
4. repos - pending
5. api handlers - pending
6. docs notes, checks, PR - pending

## Final status
Built (M1): R5.1-R5.5, R5.8-R5.20, R5.23-R5.32, R5.36, R5.37, R6.2, R6.5-R6.9, plus tray link redemption and theme preference.
Tests: internal/secrets, internal/github (+fake), internal/auth, internal/repos, internal/api/handlers_github_test.go (end to end over HTTP with fake GitHub; auth table equals openapi x-auth).
Checks: go build, go vet, go test ./..., gofmt clean, codegen drift clean, docs_check 0 errors (after docs/work removal). golangci-lint NOT run: installed binary is built with go1.25, repo targets 1.27.4, and `go tool golangci-lint` is not declared.
Open: production SQL adapter for auth.Store and repos.Store (internal/api cannot import internal/store; CRSP18 rewrites it) and main.go wiring; key import from CRSP_GITHUB_APP_KEY_FILE; hourly App health loop (R5.6); R5.7, R5.21, R5.22 webhook-driven, R5.33-R5.35, R5.38; R6.1 no-secret-column test; R6.3 redaction; R6.4 TLS policy test; config default port 8460; macOS Keychain argv exposure; no ETag on runs list; device flow flag in manifest unchecked; fake lives at internal/github/fake (brief) not githubfake (spec); web screens not built.
