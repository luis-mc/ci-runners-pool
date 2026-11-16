---
title: Move one repository from the old pool to crsp, and back
type: how-to
---
# Move one repository from the old pool to crsp, and back

For the owner, on the Windows PC where both pools run. One repository, one operating system at a time. The plan behind it is the [parity plan](../../architecture/parity-plan.md) (sections 5 and 7).

Rules that hold the whole time:

- The old pool is not deleted here. Deleting it is the owner's decision, after the parity gate.
- crsp touches only containers named `crsp-` and the variables of repositories turned on in it.
- Move one repository, then wait for a full CI run of a pull request and one run on the default branch before the next one.
- The way back is one variable. Do not remove the old runner until the 7 days are over.

## Set up the parity workflow once (from the web console)

The workflow Parity runs `crsp parity check` on a pool runner. A pool container has no `crsp login`, and you do not log in by hand. You copy nothing either: the console writes the access to the repository for you.

1. Open the crsp web console, Settings, **Access for CI**.
2. Under "Set up parity for a repository", choose the repository that holds `parity.yml` and press **Set up parity for this repository**.
3. If the page says the App needs a permission (Secrets, Variables), nothing was made. Press the two buttons it shows, one after the other: on the App page set the permission to read and write, then on the installation page press **Accept new permissions**. Come back and press the button again.
4. Done means GitHub now holds the secret `CRSP_ACCESS` and the variables `CRSP_URL` and `CRSP_CA_FINGERPRINT` for the repository. Run the workflow Parity by hand once to see it pass.

The access can only read the runner list and run the doctor. It cannot change anything. To end it, revoke it in Settings, Access for CI; the next run then fails first with a message that names this action. Pressing the button again makes a new access and replaces the secret; revoke the old one.

If the workflow fails at its first step with "Parity access is not set up", one of the three is missing: do the steps above. On a machine where you work by hand, `crsp login URL` still works, and wins over the three environment variables.

## Before you start

1. `crsp doctor` shows no `warn` and no `fail`.
2. `crsp parity check` passes (a runner of each class online, no runner listed twice, the doctor clean). The nightly workflow Parity does the same and keeps the report as the artifact `parity-report`.
3. `crsp doctor --json` lists the repository's jobs for the OS as `covered` (doctor R5.33). A `missing` or `not checked` row means the repository stays on the old pool for that OS.
4. Write down the repository's current variable values: `CI_RUNS_ON` for Linux, `CI_RUNS_ON_WINDOWS` for Windows. This is the way back.
5. Note the job times of the last runs on the old pool, for the comparison in step 6.

## Move

1. Pick the OS (Linux or Windows). Pick the repository in its wave (parity plan section 5): the one with the fewest jobs first.
2. Turn the pool on for the repository in the console (or `crsp repo enable OWNER/NAME`). crsp installs its runners and writes `RUNS_ON_<OS>`. With the setting `legacy_vars` on it also writes `CI_RUNS_ON` or `CI_RUNS_ON_WINDOWS`, so the old templates follow. Without it, set both variables by hand.
3. Do not run the old pool's setup for this repository again. It would write the old labels back.
4. Leave the repository's old runner registered and idle.
5. Run the repository's CI on a pull request. Then run it on the default branch. Watch with `crsp job watch --repo OWNER/NAME`.
6. Compare the job times with the ones you noted. A job that waits longer than before: look at it with `crsp job list --repo OWNER/NAME --state queued`, and in the console, where the wait reason is shown.
7. Run `crsp parity check`. It must still pass.
8. Lower `ci_slots` of the old pool by what moved, so the two pools do not double the slots on one PC.
9. Wait 7 days with green runs. Then the repository is done. The old runner goes away with the old pool, by the owner.

If any run is red in step 5, 6 or 9, go back (next part) and tell the agent that works on crsp which job failed. Do not retry until it is fixed.

## Move back

Use this when a run fails because of crsp, a job waits too long, or the doctor shows `fail` for the repository.

1. Set the variable of that OS back to the value you wrote down. For Linux this is `CI_RUNS_ON`, for Windows `CI_RUNS_ON_WINDOWS`. Set it in the repository's variables on GitHub.
2. Turn the pool off for the repository (`crsp repo disable OWNER/NAME`), so crsp stops writing `RUNS_ON_<OS>` and `legacy_vars`. crsp names what it removes and asks first; running jobs finish (crsp never cuts a job).
3. Check that the old runner is online and idle on the repository's runner list on GitHub. If it is offline, start it with the old pool's own tools.
4. Raise `ci_slots` of the old pool by what the repository had.
5. Run the repository's CI on a pull request. It must run on the old runner.
6. Write what failed in the repository's note for the parity plan (P10 asks for one way back per wave).

## What this runbook does not do

- It does not start the soak. The soak is defined in `internal/parity` and judged by `crsp parity soak`; the owner starts it when the fixture jobs exist.
- It does not delete the old pool.
