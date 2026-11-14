#!/usr/bin/env python3
"""Default-branch CI skip (STACKSPEC 13.1). Standard library only.

On a push to the default branch, skip the suite when the pushed commit's tree
already passed this workflow on a pull request whose head commit has the same
tree. Anything else (a pull request, an API error, no match) means skip=false:
the suite runs. The script never fails the job.

Env: GITHUB_EVENT_NAME, GITHUB_REPOSITORY, GITHUB_SHA, GITHUB_TOKEN,
GITHUB_OUTPUT (optional), CI_WORKFLOW_FILE (default ci.yml).
"""
import json
import os
import sys
import urllib.request

API = "https://api.github.com"
MAX_RUNS = 50


def api_get(path, token):
    req = urllib.request.Request(
        API + path,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + token,
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def commit_tree(repo, sha, get):
    return get("/repos/%s/git/commits/%s" % (repo, sha))["tree"]["sha"]


def should_skip(event, repo, sha, get, workflow="ci.yml"):
    """Return (skip, reason). `get` maps an API path to parsed JSON."""
    if event != "push":
        return False, "event %s is not a push" % event
    tree = commit_tree(repo, sha, get)
    data = get(
        "/repos/%s/actions/workflows/%s/runs?event=pull_request&status=success&per_page=%d"
        % (repo, workflow, MAX_RUNS)
    )
    seen = set()
    for run in data.get("workflow_runs", []):
        head = run.get("head_sha")
        if not head or head in seen or run.get("conclusion") != "success":
            continue
        seen.add(head)
        if commit_tree(repo, head, get) == tree:
            return True, "tree %s passed on pull request run %s (head %s)" % (
                tree[:12], run.get("id"), head[:12])
    return False, "no successful pull request run with tree %s" % tree[:12]


def write_output(skip):
    line = "skip=%s\n" % ("true" if skip else "false")
    path = os.environ.get("GITHUB_OUTPUT")
    if path:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line)
    sys.stdout.write(line)


def main():
    env = os.environ
    try:
        token = env["GITHUB_TOKEN"]
        skip, reason = should_skip(
            env.get("GITHUB_EVENT_NAME", ""),
            env["GITHUB_REPOSITORY"],
            env["GITHUB_SHA"],
            lambda p: api_get(p, token),
            env.get("CI_WORKFLOW_FILE", "ci.yml"),
        )
    except Exception as exc:  # fail open: the suite runs
        skip, reason = False, "check failed, running the suite: %s" % exc
    print("ci_skip_check: " + reason, file=sys.stderr)
    write_output(skip)
    return 0


if __name__ == "__main__":
    sys.exit(main())
