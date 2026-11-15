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
