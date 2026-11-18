---
change: minor
task: LOOK27
---
Settings are one Save per tab (owner decision D26): Repositories, Console and Data are each one form, and the action bar (component 48, UX-71) says "Unsaved changes (N)" and carries Cancel and one Save for the whole tab, disabled with its reason while nothing changed. Add a user, Add channel (was Add), Make, Choose an address, Update to N, Back up now and the other actions that do not save are normal buttons inside their section. Doctor holds "Run checks again" (D27; "Run checks" before the first run) as its one primary in the bar; the Open button of a finding stays a normal button. Jobs (Export, or Add runners when there are none), a job (Open the run on GitHub), Setup (Open the overview), sign-in (Sign in with GitHub or Try again), the no-access page (Sign out) and the Audit log tab (Export) draw their one primary in the bar. The known list of `scripts/design/action-bar.test.ts` is empty.
