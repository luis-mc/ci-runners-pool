@AGENTS.md

## Pull requests (owner decision, 2026-11-14)

- Agents may open pull requests, mark them ready, and edit their title and description on repositories the owner owns (`luis-mc/*`).
- This is an exception to "never send posts in the owner's name" for pull requests only.
- Issues, comments, reviews, emails and messages stay drafts written as files.
- In this repository the orchestrator merges a pull request once every CI run on its head is green (owner decision, 2026-11-14). Never auto-merge; a red pull request waits for the owner.

## Context-efficiency behavior

After a `/compact` or any context reset, trust the compact summary — don't
re-read files, configs, or SKILL.md content just to confirm understanding
before answering a question. Re-read a specific file only right before
*acting* on it (editing it, quoting exact current content, or checking
whether a specific claim is stale). Verifying the whole state eagerly after
a reset burns tens of thousands of tokens for no functional gain.
