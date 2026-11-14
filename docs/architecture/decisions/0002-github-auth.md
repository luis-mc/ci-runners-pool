---
id: 0002-github-auth
title: A GitHub App per controller, JIT runners, no stored personal tokens
status: accepted
date: 2026-11-13
supersedes:
superseded_by:
type: explanation
---
# A GitHub App per controller, JIT runners, no stored personal tokens

## Context and problem

Users sign in with their own GitHub account.
The product must then list the repositories and organizations the user can administer.
It must also register and remove runners, set repository variables, and learn about queued jobs.
It is open source and self-hosted, so it cannot ship a shared secret.

## Options considered

1. **A GitHub App that each controller registers for itself.**
   Pros: sign-in through the App's user OAuth flow, with a token that acts as the user.
   That token reaches only repositories the user can see and where the App is installed.
   Short-lived installation tokens for runner and variable work.
   Fine-grained permissions.
   Webhooks per installation.
   Works for user accounts and organizations.
   Cons: each controller needs its own App.
   The manifest flow makes that one click in the first-run wizard.
2. **A classic OAuth App.**
   Pros: simpler sign-in.
   Cons: broad scopes (`repo`, `admin:org`) that see every repository.
   No per-repository webhooks, so polling only.
3. **Personal access tokens.**
   Cons: long-lived, broad and stored.
   Rejected by the product rules.
4. **One shared App owned by the project.**
   Cons: its private key would have to ship in an open-source binary.
   Not possible.

## Decision

Option 1.
The first-run wizard creates the App with GitHub's App manifest flow.
The web console signs in with the App's user OAuth flow.
The CLI signs in with the device flow.
The App private key and the webhook secret live in the OS secret store: Windows Credential Manager or DPAPI, macOS Keychain, Linux Secret Service, or a file with mode 0600.
They never go to the database, logs or config files.

Runners:

- Ephemeral just-in-time runners are the default: one runner per job, registered with a JIT config from `generate-jitconfig` (repository or organization level), gone after the job.
- Persistent runners are an option for machines that cannot start fresh environments fast.
  The console marks them as persistent.
- Registration and remove tokens are fetched when needed and dropped after use.
  A runner is deregistered with a remove token; GitHub refuses a registration token there.

Demand:

- First choice: the runner scale-set API (long-poll message sessions, `TotalAssignedJobs` as the signal), through `github.com/actions/scaleset`.
- Fallbacks: the `workflow_job` webhook (queued, in_progress, completed), then polling the REST API.

Targeting:

- Runners carry only generic capability labels (`self-hosted`, OS, architecture, `docker`, `kvm`, `gpu`, a pool name).
  Never a project name.
- The product sets repository variables such as `CI_RUNS_ON` and `CI_RUNS_ON_WINDOWS` (JSON lists).
  Workflows use `runs-on: ${{ fromJSON(vars.CI_RUNS_ON) }}`.
- The product checks every workflow's `runs-on` against the labels that exist and warns on a label no runner carries.

Public repositories: jobs from fork pull requests never reach the pool unless the user turns it on per repository, with a warning.

## Consequences

- The App needs these permissions at least: repository administration (self-hosted runners), actions variables, metadata.
  Organization self-hosted runners and runner groups when an organization is used.
  The exact list is fixed in milestone 1 and recorded in the GitHub feature spec.
- Development needs one dev App, made with the manifest flow when milestone 1 code needs it.
- The scale-set client is a public preview.
  Milestone 1 checks its API again before relying on it, and keeps the webhook and polling paths working.
- Runner groups are used when the user has an organization.
  Repository-level runners are used otherwise.
