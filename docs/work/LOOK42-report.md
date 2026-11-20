# LOOK42 follow-up report (Help proposals G to K)

Branch: LOOK42-help-proposals. Page: review/help/index.html. Branch-only file; never in a PR for the default branch.

## Step log
- [x] Setup: pnpm install frozen, golangci-lint 2.15.0 at $HOME/go/bin, apps/web built for the review harness.
- [x] Research (WebSearch; WebFetch to www.nngroup.com failed: host not in the session's allowed network domains, so NN/g points rest on search excerpts only).
- [ ] Build proposals G to K (review/help/build/proposals2.mjs), render, update page.
- [ ] Page: research section, comparison, recommendation, questions moved.
- [ ] Final push.

## Notes
- DS v3 read from origin/LOOK40-ds-v3-draft (docs/design-system/v3): UX-5/54 wizard, UX-41 show don't tell, UX-43 popover (bottom sheet on phone), UX-44/46/47 overlay, UX-47 folded section, UX-10/51 card grid.
- pnpm install ran the repo's `prepare` script, which set core.hooksPath=.githooks in .git/config (not done by hand).
