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
