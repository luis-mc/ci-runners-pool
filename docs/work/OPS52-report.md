# OPS52 report: pool findings of 20 Nov

Branch `OPS52-pool-findings` (base RELEASE-48). Six items, each with a spec requirement, Go code and tests.

## Found already built (not duplicated)
- Item 3: runners R5.67 / doctor R5.41 already wait quietly for a bounded window (3 min). Gap: the window is shorter than the 4 minutes seen, there is no backoff, the reason text is not on the runner.
- Item 5: doctor R5.48 `machine.runner_leftovers` already lists runner folders no runner owns and removes them on a press (never alone). Gap: only tested for folders with services; add the plain unused folder case.
- Item 6: caches R5.51 to R5.54 `CompactMachine` already drains, waits, compacts, resumes. Gap: the owner has no console button; the size before is not on the confirm card.
- Item 4: R5.15 makes the password inside the process; it has symbols (`!#%+-=?@`). Gap: letters and digits only.
- Item 2: `addRunner` rolls back a failed agent add. Gap: a failure after the agent registered (writing the local service record) leaves the registration; doctor has `runner.orphan` and `runner.registered` but no button.
- Item 1: runner caches are per runner folder; repository lanes are made 0755 by the agent, so a second runner user cannot write. Gap: per-runner build folder, group/ACL grant, doctor check.

## Steps
