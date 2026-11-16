# CRSP148 report: GitHub regression after v0.1.2 -> v0.1.3

Branch `CRSP148-github-regression`, base main 058456b (RELEASE-25).

## Root cause (read from the RELEASE-25 diff and the code it runs)

1. **Candidate "token minting asks for secrets": ruled out.** `installationToken`
   (internal/github/client.go) posts to `/app/installations/{id}/access_tokens`
   with no body and no `permissions` map. `RequiredPermissions` gained `secrets`
   only for the manifest and the grant diff, never for a token request.
   `ForgetInstallationToken` only drops a cache entry. A regression test now pins this.
2. **Candidate "migration reset pool_on": ruled out.** RELEASE-25 adds no
   migration (last is 00015, from RELEASE-24). `UpsertRepository` never writes
   `pool_on`. A regression test now pins this with a v0.1.2 database.
3. **Stale for every call, "need admin rights" (the field report).** The user's
   GitHub token and the per-user admin flags live in memory only (R6.2).
   Every upgrade restarts the service, so both are empty until the person
   signs in with GitHub again. `GitHubArea.refresh` then:
   - swallows every `Sync` error, including `ErrGitHubSessionExpired` and a
     GitHub 4xx/422, and returns `stale:true`; the page prints one fixed text,
     "GitHub is not answering". The real status and message are lost (UX-28).
   - `view()` reads `s.admin[user][repo]`, which is empty after a restart, so
     every repository is `user_is_github_admin:false`. The page then says "you
     need admin rights" and the Turn on button is locked. Unknown read as "no".
4. **pool_on false on home-automation.** `ReconcileInstallations` runs at
   start and turns off (`ChangedByInstallation`) every pool-on repository that
   is not in `reach`. A suspended installation is skipped with `continue` and
   adds nothing to `reach`, and an empty live list from GitHub does the same, so a
   single odd read after the upgrade switches a pool off. A read that cannot
   prove the repository left must keep the last value. (The exact GitHub answer
   on the owner's machine cannot be seen from here; the fix makes every
   unproven read keep the value.)

## Fix

- A sync error is classified: session expired, missing permission (grant step),
  or GitHub error with its real status and message. `Staleness` carries
  `reason`, `status`, `message`; the page prints them, never "not answering"
  unless GitHub is unreachable (UX-28).
- Admin flags unknown (no sync since start) are not "no": the page does not say
  "you need admin rights" while the list is stale; the plan still checks admin
  fresh at the change (R5.19).
- Reconcile keeps pool_on for a suspended installation and for an empty or failed read.
- Tokens are minted without a permissions map (tested).

## Tests

Fake GitHub tests per item plus an upgrade test (v0.1.2 state, migrations, pool_on kept).
