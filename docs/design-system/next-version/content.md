# Content: the words users see

> **Starter.** Every item in this file is a starter item. Keep, change or delete each one before v1 is approved.

Labels, messages and vocabulary live here (DOCSPEC R11.3). One word per action, in every app (UX-1).

## Action vocabulary

Each action has one word. The Never use column lists words that must not stand in for it.

| Word | Meaning | Never use |
|---|---|---|
| Save | Keep the changes made in a form. | Submit, Apply, Update |
| Cancel | Leave a form or question without doing anything. | Close, Back out, Discard |
| Add | Put a new item in a list. | Create, New, Insert |
| Edit | Change an item that already exists. | Modify, Change |
| Remove | Take an item out of a list. The item itself stays. | Delete, Clear |
| Delete | Destroy the item for good. | Erase, Trash, Remove |
| Clear | Empty a selection or a filter. | Reset, Deselect |
| Select all N | Select every item in the list. N is the count. | Check all, Pick all |
| Stop | End work that is running. | Cancel, Abort, Kill |
| Try again | Repeat something that failed. Also asks once more for a state. | Retry, Redo, Check again, Check now, Recheck |
| Refresh | Load the shown data again. | Reload, Update |
| Review | Open what waits for a decision, to look it over. Also the name of every looking-over step, and of the first of the last three steps of a wizard that changes something. | Check, Confirm, Summary |
| Hide | Stop showing something. It is kept. Also the x on a note. | Dismiss, Close |
| Show | Show something that was hidden. | Reveal, Unhide |
| Open | Go to an item to see it. | View, Go to |
| See all N | Go from a preview to the whole list. N is the count. | More, View all |
| Back | Go to the step before. | Previous |
| Next | Go to the step after, when it is not the last step. | Continue, Forward |
| Done | The last step of a wizard: what really happened, never the plan. Its one primary is the next action. | Finish, Finished, Complete, Result, OK |
| Search | Look for text in a list. | Find, Look up |
| Sort | Order a list by a column. | Order, Arrange |
| Sign in with GitHub | Start the GitHub sign-in. | Log in, Login |
| Sign in with GitHub again | The action of the needs-you message when the GitHub sign-in ended; starts the GitHub sign-in and returns to the same screen. | Log in again, Reconnect |
| Sign out | End the session. | Log out, Logout |
| Stop new jobs | Stop a machine taking new jobs; the running ones finish. A secondary button, with the hint line "Running jobs finish first. Resume takes jobs again." Question card title "Stop new jobs on {machine}?"; busy word Stopping new jobs. The API and CLI keep the name drain. | Drain, Pause, Disable |
| Resume | Let a machine that stopped new jobs take jobs again. | Enable, Undrain |
| Turn on | Let a repository use the pool. | Enable, Activate |
| Turn off | Stop a repository using the pool. | Disable, Deactivate |
| Copy | Copy a command or a value. It changes nothing. | Clipboard |
| Look for updates | Ask GitHub for a newer stable release now. It only looks: it never installs by itself, with Automatic updates on or off. A newer release opens the update dialog, which asks first. | Check for updates, Refresh |
| Update to N | Install release N after the running jobs end. N is the version. | Upgrade, Install |
| Restart the service | Stop and start the service after the running jobs end. | Reboot, Reset |
| Automatic updates | The switch that lets the regular check install a newer stable release by itself after the running jobs end. A look a person asks for never installs by itself. | Auto-upgrade |
| Install now | The main button of the update dialog, on the right. Installs the newer release after the running jobs end; it stops none. | Update now, Upgrade, Yes |
| Later | The other button of the update dialog, on the left. Changes nothing. Closing the dialog is Later. | Not now, Skip, No |
| What changed | The link of the update dialog to the release page of the new version. It changes nothing. | Release notes, Changelog |
| Quit tray | Close the tray icon only. The service keeps running. | Exit, Close |
| Export | Save every row of a table or list as a file, in the order shown (component 29). It changes nothing. | Download, Save as |
| Run checks again | Start the doctor now, on the Doctor page, as its one primary in the action bar. Before the first run it says Run checks. While it runs the button says Running the doctor. | Run the doctor, Scan, Check |
| Add channel | Open the form of a new notification channel. It changes nothing until the tab's Save. A normal button. | Add, New channel, Create |
| Widen the range | Show a longer time range when the range shown has nothing. | Expand, Zoom |
| Zoom in, Zoom out | Show a shorter or a longer time range on a time axis. | Narrow, Expand |
| Show earlier | Load the rows before the last one on a time axis. It is also loaded by itself as the end nears the screen. | More, Older |
| Wipe | Empty one cache of everything it holds, after the running jobs that use it end. The cache stays. | Clear, Purge, Empty, Flush |
| Rebuild | Build an image again after the running jobs end. The old image serves until the new one is ready. | Recreate, Refresh, Reinstall |
| Export config | Save the configuration as a file, without any secret. | Download config, Backup config |
| Exporting | The busy word of Export, while the controller builds the file. | Downloading |
| Load more | Read the next rows of a list that has more on the controller. | Show more, Next page |
| Send test | Send one clearly marked test notice through a channel and say what happened. It changes nothing else. | Test, Ping, Verify, Send a test |
| Pause for 1 hour, Pause until I resume | Hold a machine from taking new jobs for an hour, or until Resume. The running jobs finish. | Stop, Suspend, Disable |
| Resume | End a pause, and let the machine take jobs again. The machine page and the tray use it. | Unpause, Restart, Enable |

Add a row for each action the project needs. A new action gets a word that is not used above.

## Retired words

A retired word is not drawn as a label, button or message. The guard scans the source for each one. Do not list an approved word here.

<!-- retired-words:start -->
| Retired | Use instead |
|---|---|
| Submit | Save |
| Click here | (name the action) |
| Retry | Try again |
| Reload | Refresh |
| Abort | Stop |
| Dismiss | Hide |
| Check | Review (to look over, or to open what waits), or Try again (to ask once more for a state) |
| Check again | Try again |
| Check now | Try again |
| Recheck | Try again |
| Erase | Delete |
<!-- retired-words:end -->

## Wizard step names

A wizard that changes something ends with three steps (UX-30).

| Step | Name | Shows |
|---|---|---|
| First of the last three | Review | What will happen, in numbers and words. "Nothing has changed yet." |
| Second | The work, in the "-ing" form | Live progress: "Moving 3 of 12". |
| Third | Done | What really happened, what was left, and what failed. |

A step that only reads before Review is named by what it reads ("Reading files", "Reading folders"). It changes nothing. It is never called "Checking". The wait for the data of the current step is one line of the same words ("Reading machines"), shown in that step and beside its locked primary; it is not a step in the step row.

## Wizard state words

Each word is used for one thing in a wizard (UX-30).

| Word | When to use it |
|---|---|
| Stop | Work is running and the user ends it. |
| Stopping | Stop was pressed and the work has not ended yet. |
| Pause | The work holds its place and can go on later. |
| Try again | A failed action is repeated. It repeats that action only. |
| Start again | The wizard has ended (Done or Stopped) and the user begins a new run. |
| Put back | Undo what the run changed, when that can be undone. |

## App health and left-installation words

The words of the App-gone banner on the Overview (github-integration R5.6) and the reason a repository left the installation (R5.22).

| Where | Word |
|---|---|
| Banner (problem) | The GitHub App is gone. {reason} crsp has stopped its GitHub work. Jobs that are running keep running. |
| Banner action | Run the setup wizard again |
| Reasons | GitHub does not know this App any more. / GitHub refused the App's key. / The App's key is not in this machine's secret store. |
| List word | left the installation (in the Last delivery column of a repository the controller turned off) |
| Repository fact | Why it is off: This repository left the GitHub App's installation, so its pool was turned off. |

## Message wording

A message is one or two short sentences in plain words. It names the thing, never a code or a path.

| Tone | Pattern | Example |
|---|---|---|
| Done | What was done, in the past tense. | Settings saved. |
| Note | A fact the user may want to know. No action is needed. | 3 items are hidden by the filter. |
| Needs you | What is waiting, and what the user can do. | The report needs a title. Add a title to go on. |
| Problem | What failed, why, and what next. | Could not save. The connection was lost. Reconnect, then try again. |

- Start with the subject, not with "Error" or "Oops".
- Say what happened first, then what to do.
- Use the same word for the same thing every time.
- Never blame the user.

## Empty, failed and waiting states

- **Empty:** say what will appear here, and offer the action that fills it. "No reports yet. Add a report to start."
- **Failed:** say what failed, why, and what next.
- **Waiting:** name what is happening. "Loading 3 of 12 reports."

## Dates, times and numbers

| Kind | Format | Example |
|---|---|---|
| Date | Year-month-day. | 2026-11-02 |
| Time | 24-hour, local time. | 14:30 |
| Date and time | Date, a space, then time. | 2026-11-02 14:30 |
| Number | Digits, with a space for thousands. A dot for decimals. | 12 345.5 |
| Count | A number before the noun. The noun agrees with the count. | 1 item, 3 items |
| Size | A number and a unit, with a space. | 4.2 MB |
| Percent | A number and the percent sign, no space. | 45% |
| Full stamp | Date and time with seconds. Only in logs and exact moments. | 2026-11-02 14:30:05 |
| File stamp | Date and time for a file name, joined by dashes. | 2026-11-02_14-30-05 |
| Past moment | The exact time first, then how long ago. | 2026-11-02 14:30 (5 h ago) |
| Time left | Short words, never seconds. | about 2 min left |
| Sentence | Minutes only, and the time zone is never named. | Published 2026-11-02 14:30. |
| Duration | Short words, seconds kept, never negative. | 45 s, 4 min 12 s, 1 h 5 min |

## Images and caches words

The words of the images and caches screen (web-console 4.7).

| Where | Word |
|---|---|
| Tabs | Images, Caches |
| Cache kinds | Tool cache, Rust build cache, Actions cache, Git mirror, Registry mirror, Dependency cache |
| Empty images | No images yet. A machine shows one here once it can run container jobs. |
| Empty caches | No caches yet. Caches show here when a runner has been added. |
| Question title | Wipe {cache}? Rebuild the image of {machine}, {OS}? |
| Wiping | Wiping {cache}, waiting for {jobs} |
| Last wiped, none | never |
| No cap | {size}, no cap |
| Over the cap | {size} of {cap} ({percent}), over the cap |
| Wipe failed | Could not wipe {cache}. {why} |
| Rebuild failed | Could not rebuild. {why} The old image keeps serving. |
| Image state, before the first build | not built yet |
| Images list title and line | Images; Each machine has one Linux image. Its repositories' jobs run from it. |
| Image row status | Missing {layers} · needed by {repositories} (amber); Not built yet (quiet); Has what its repositories need |
| Image row note | {n} extra layer, {n} extra layers, base only |
| Image facts line | Built {time} · {size} · used by {repositories}; Not built yet. Choose layers now; it is built when its first runner starts. |
| Missing layers banner | {repository} needs {layer}; {repositories} need {layers}; Add it, Add them |
| Layers pane | Layers; Add what your repositories' jobs need. The basics are always included. |
| Layer purposes | for browser tests, for Windows builds from Linux, for MSI installers, for .deb and .rpm packages, for tests that boot a VM |
| Layer needed by | needed by {n} (amber when needed and not ticked) |
| Layers footer | Cancel, Save and rebuild (Save before the first build); Rebuilds after running jobs finish. The old image keeps working until then. |
| Folded part | What is inside this image; Always included: {tools}; Extra packages set by repositories: {repository}: {packages}; None; Rebuild |
| Layer line, read only | {layer} · on |
| Layers differ | The saved layers differ from the built image. Rebuild to use them. |

## Labels

- A button says what it does: "Save", not "OK".
- A headline says where the user is: "Reports", not "reports/list".
- A field name is a noun: "Title", not "Enter the title".
- Mark only optional fields, with "(optional)" after the name.

## Light runner words

The words of the repository policy form for the light runner (scheduling R5.65).

| Word | Meaning |
|---|---|
| Light runner | A runner kept free for jobs that last seconds, so they do not wait behind a long build. |
| Keep a light runner for short jobs | The switch on the policy form. On by default. |
| A light runner is kept free for jobs that last seconds, so they do not wait behind a long build. A workflow uses it with runs-on: ${{ vars.RUNS_ON_LIGHT }}. | The note under the switch. |
| No light runner is online for {os} on {repository} | The doctor finding when the runner is missing. |

## Machine policy words

The words of the machine mode, the battery pause and the CPU cap (machines R5.61 to R5.64, tray R5.42, web-console R5.65). The tray and the console use the same words.

| Word | Where and meaning |
|---|---|
| When it works | The section title on the machine page. |
| Mode | The name of the one-choice list and of the tray submenu. |
| Automatic | A mode. Takes jobs. Pauses on battery and while you have paused it from the tray. |
| Always | A mode. Takes jobs on battery too. A pause from the tray still holds. |
| Paused | A mode, and a state word. Takes no new job. The jobs that run finish. |
| Takes jobs | The column of the machines list. |
| Finishing {n} jobs (up to {m} min) | State word of a machine that stopped new jobs and still runs jobs ({n} running jobs it waits for, {m} the time to finish running jobs; one job: "Finishing 1 job"). The list and the filter say "Finishing jobs"; the Overview says "finishing jobs". |
| Not taking jobs | State word of a machine that stopped new jobs and has no running job. The filter says the same. |
| Time to finish running jobs | The setting field (machine and pool defaults), in minutes. Help: "How long running jobs may take to finish when new jobs are stopped. crsp never cuts a job." (pool: "...when a machine stops new jobs.") |
| Waiting for jobs to finish | Section title of the job that holds a machine that stopped new jobs. |
| Stop new jobs on {machine}? | Question card title. Lines: "Running jobs finish first, for up to {m} min." and "Nothing is removed. Resume undoes it." Primary: Stop new jobs. |
| Taking jobs | State word: the machine takes new jobs. |
| Paused, On battery, Quiet hours | State words: why the machine takes no new job. |
| Busy | State word: the load is over the budget, so a new job waits. The tray header does not say it. |
| Needs a base image, Disk low | State words: a backend it may use has no runner base image on the machine; the disk is almost full. |
| You stopped new jobs from the console. The jobs that run finish. Resume takes jobs again. | The note under Now for Not taking jobs. |
| The mode is Paused. It takes no new job. The jobs that run finish. | The note under Now for Paused by the mode. |
| It was paused from the tray. It takes no new job. The jobs that run finish. | The note under Now for Paused from the tray. |
| New jobs are stopped. Resume takes jobs again. | The hint under Resume in the page header. |
| Now | The facts line with the state word. |
| Paused until | The end of a pause from the tray with a timer. A date and time (Dates, times and numbers). |
| Until you resume | The value of the fact Paused for a pause from the tray that has no end. |
| Power | The facts line. Values: On battery, On mains. Shown only when the machine's battery state is known. |
| Pause on battery | The switch. Saved at once. |
| Always ignores the battery. | The reason beside the Pause on battery switch in Always; the switch is off and disabled. |
| Off: the machine keeps taking jobs on battery. | The note under the switch when it is off. |
| On: Automatic takes no new job while the machine runs on battery. | The note under the switch when it is on. |
| CPU for runners | The name of the CPU cap list. Values: 25%, 50%, 75%, 100%. |
| The most CPU the runner processes may use. The load budget stays as it is. | The help under the CPU cap list. |
| Not supported on macOS yet. The runners use all the CPU. | The help under the CPU cap list on macOS. |
| Not supported on macOS yet. | The reason on each CPU cap value on macOS. |
| The CPU cap was not set. {why} | Problem message when the agent could not set the cap. |
| Setting the CPU cap. | Note while the agent has not yet reported the result for the chosen value. |
| It takes no new job. The jobs that run finish. | Note under the state when the machine is paused. |
| It takes no new job while it runs on battery. The jobs that run finish. | Note when the machine is on battery. |
| It takes no new job in quiet hours. The jobs that run finish. | Note in quiet hours. |
| Its load is over the budget. A new job waits until the load drops. | Note when the state is Busy. |
| Could not save. {why} | Problem message when a change was not saved. |
| Could not change the mode. Could not pause. Could not resume. | Titles of the tray notice when a menu change failed. |
| This service cannot change the mode. Open the console and go to Machines. | Tray notice for a service that does not report a policy. |
| waits because its machine is paused, waits because its machine runs on battery | Job wait reasons on the jobs screen. |

## Tray menu words

The words of the tray menu (tray R5.1, R5.42; owner decision D10, TRAY3). No entry is bold.

| Word | Where and meaning |
|---|---|
| Open console | The tray entry that opens the console, signed in. |
| Open Doctor | The tray entry that opens the console Doctor page. |
| Pause | The tray submenu. Its items are "for 1 hour" and "until I resume". |
| Paused until {time} - Resume now | The tray entry in place of Pause while a timed pause holds. {time} is hours and minutes. Pressing it resumes. |
| Paused - Resume now | The same entry for a pause with no end. |
| Mode: {mode} | The tray submenu; {mode} is Automatic or Always. It holds those two modes only. |
| Running - {n} jobs - {m} runners | The tray status line. Pressing it opens the console Jobs page. Reads "Running - no runners yet" before the first runner. |
| ↑ Update to {version} | The tray entry for a newer release. It opens the update dialog, which asks first. |

## Connect GitHub words

The words the Connect GitHub step shows when GitHub sends the person back with an error (github-integration R5.3, web-console setup screens). The page picks the message by the error code in the address and then clears the code from the address.

| Word | Where |
|---|---|
| GitHub made the App, but crsp could not save it. Open the App on GitHub and delete it (App settings, Advanced, Delete GitHub App). Then start again. | Problem message when the App exists at GitHub and nothing was kept. |
| Open the App on GitHub | The button that opens the half-made App in a new tab. |
| GitHub App names are unique across GitHub. If GitHub says the name is taken, delete the old App or choose another name. | Help under the App name field. |
| crsp could not save the App because the OS secret store is not available. See the doctor. Then start again. | Problem message, code unavailable. |
| GitHub could not be reached. Nothing was changed. Try again. | Problem message, code github_unavailable. |
| The link back from GitHub did not work. It ran out or was used already. Start again. | Problem message, code bad_request. |
| An App is already set up. | Problem message, code conflict. |
| The App was not created. Start again. | Problem message, any other code. |

## Notification words

The events, severities and channel kinds of the notifications feature, as people read them (notifications R5.1, R5.4). The stable type names stay in the API and in webhook bodies; the screen shows these words.

| Word | Meaning |
|---|---|
| Machine offline | A machine's agent link has been down longer than the grace time. |
| Job waiting | A queued job has waited longer than the set time. |
| Disk low | Free space on a machine's work disk is below the threshold. |
| Runner outdated | A runner's version is older than the pinned version. |
| Doctor finding | The doctor reports a new finding. |
| Update available | A newer stable release exists. |
| Info, Warning, Error | The lowest severity a channel gets. |
| Email, Webhook, Desktop | The kinds of channel. |
| Channel | One way of being told: an email address, a webhook or a desktop notice. |

## Why a job waits

The words of the list "Why jobs wait" (scheduling R5.48). The gate's own line with its numbers goes after the colon; the reason alone gives the plain sentence.

| Reason | Words |
|---|---|
| Section title | Why jobs wait |
| Table caption | Waiting jobs |
| Column | Why it waits |
| Empty | No jobs are waiting. |
| No machine for the OS or labels | No machine has this OS and these labels. |
| Over the budget | Over the load budget: {numbers}. (Over the memory or CPU budget.) |
| No free slot | No free slot: {n} ahead in the queue. |
| Parallel limit | The repository is at its parallel limit. |
| Machine drained | The machine is not taking jobs. |
| Load not measured | Load not measured yet. The machine cannot read its load, so the job waits. Run the doctor to see why. |
| Reason not known | Waiting. The reason is not known yet. |

## Component words

The words of the shared components (`design_system.py components`). A project changes a word here and passes it to the component through its `labels` prop. `{min}`, `{max}`, `{n}`, `{unit}` and `{pattern}` are filled in by the component.

| Word | Component |
|---|---|
| Previous month | Date picker |
| Next month | Date picker |
| Month | Date picker |
| Year | Date picker |
| Or type the date | Date picker |
| Type the date as {pattern}. | Date picker |
| Pick a date from {min} to {max}. | Date picker |
| Hours | Time picker |
| Minutes | Time picker |
| Seconds | Time picker |
| More {unit} | Time picker |
| Fewer {unit} | Time picker |
| Morning or afternoon | Time picker |
| Quick picks | Time picker |
| {n} hours | Time picker |
| {n} minutes | Time picker |
| {n} seconds | Time picker |
| Delete last digit | Number keypad |
| Type a number. | Number keypad |
| The lowest is {min}. | Number keypad |
| The highest is {max}. | Number keypad |
| Type all {n} digits. | Number keypad |
| From {min} to {max}. | Number keypad |
| Drop the file here, or | File field |
| Choose a file | File field |
| Change | File field |
| Remove {name} | File field |
| Choose a {pattern} file. | File field |
| Full error | Table: the button of a failed runner's long reason |
| Details | Table: the button of any other long text (Doctor, Jobs) |

## Pool size words

The words of the Pool size section on a machine's page (machines R5.58, LOOK22). It is a plain section of the page's one form; there is no wizard and no Save of its own (UX-71).

| Where | Word |
|---|---|
| Section | Pool size |
| Fact names | Pool size now, Room for the pool, CPU budget |
| Not set | not set |
| Budget not known | Budget: not known yet; the three choices say The budget is not known yet. |
| Choice name | New pool size |
| Choices | Recommended: half of the free room ({memory}, {cpus}); Recommended: three quarters of the free room ({memory}, {cpus}); Custom |
| How computed (line under a recommended choice) | Half of the {room} free for the pool, rounded down to whole GiB. CPUs: the same share of the CPU budget ({budget}), at most one per 1.5 GiB. (Three quarters: the same with Three quarters.) |
| Custom | Choose the memory and the CPUs yourself. Fields: Pool memory (help: Memory the pool may use on this machine, in GiB.), Pool CPUs (help: CPUs the pool may use on this machine.) |
| Mistakes | The pool needs at least {n} GiB. The pool needs at least {n} CPUs. |
| Reading | Reading the budget of {machine}. |
| Check line, fits (done) | This size fits the budget of the machine. |
| Check line, little left (needs you) | This size fits, but leaves {left} for this PC. (Shown when less than 3 GiB of the room is left.) |
| Check line, lower size (needs you) | This lowers the pool size. Jobs that need more than the new size wait or fail to start. |
| The tick | Yes, lower the pool size |
| Check line, does not fit (problem) | This size does not fit the budget. {reason} The nearest sizes that fit: {sizes}. (memory over the room: see Too big) |
| Too big (memory over the room) | {requested} is too much: only {room} is free for the pool right now (other programs use {used}). Use {fit memory} and {fit cpus}? |
| Too big, button | Use {fit memory} and {fit cpus} (applies both sizes to the fields; it does not save) |
| Too big, CPU reason | {fit cpus}: each CPU needs about 1.5 GiB. (shown when the CPUs change with the memory) |
| Too big, room note | The room moves with what else runs on this PC. |
| Cannot check | The size cannot be checked yet. {why} Try again when the agent has reported. |
| Reasons beside the page's Save | Reading the budget. The size cannot be checked yet. This size does not fit. Change the pool size. Tick the box to confirm lowering the pool size. |
| Changed while editing | The pool size changed to {size} while you edited. Nothing was saved. |
| Not saved | The pool size was not saved. {why} Try again. |

## Extra packages words

The words of the extra packages form on a repository's page (runners R5.51).

| Where | Word |
|---|---|
| Section | Extra packages |
| Field | Extra packages (optional) |
| Help | Distribution packages added to the pool image, one name per line. |
| Note | A changed list builds a new image aside. Running jobs keep the old image until they end. |
| Mistake | Line {n}: {name} is not a package name. Use letters, digits and + - . only, and do not start with -. |
| Buttons | Save packages (busy word: Saving), Cancel (puts the saved list back) |
| Done | Extra packages saved. |
| Failed | Could not save the packages. {why} |

## Theme words

The words of Settings, Appearance (UX-60).

| Place | Word |
|---|---|
| Choice label | Theme |
| Choice help | The colours of the console. The choice is saved at once. |
| Theme names | Phosphor, Tokyo Night, Catppuccin, Gruvbox, Solarized, Nord |
| Mode label | Mode |
| Mode help | System follows your device. The choice is saved at once. |
| Mode choices | System, Dark, Light |
| Passing message | Saving the mode. |
| Failure | Could not save the mode. |
| Key-hint bar | `/` search, `j k` move, `Enter` open, `?` keys |

## Demand and webhook words

The words of the doctor findings `demand.quiet` and `github.webhook` (github-integration R5.37, doctor R5.16).

| Where | Word |
|---|---|
| Quiet, ok | The demand source sees the queued jobs of {repository} |
| Quiet, warn | {repository} has {n} jobs queued for the pool and the demand source has seen none |
| Quiet, first detection | Quiet since {time}. |
| Quiet, restarted | Quiet since {time}. The controller restarted the demand loop once, at {time}, and it is still quiet. |
| Quiet fix, first | The controller restarts the demand loop once by itself. Run the doctor again in a minute. |
| Quiet fix, restarted | Restart the controller service. If it stays quiet, check that GitHub is reachable and the App can read Actions (github.app.permissions), then read the controller log for "poll queued jobs". |
| Webhook, ok | Webhook deliveries arrive ({n} in 24 hours, {n} failed) |
| Webhook, idle | No webhook delivery in 24 hours, and no job is open |
| Webhook, failed | {n} of {n} recent webhook deliveries failed |
| Webhook, none | No webhook delivery arrived in 24 hours while jobs are open |
| Webhook fix | Check that GitHub can reach the controller (the webhook address in the App settings). The polling fallback is in use meanwhile. |

## Hosted fallback words

The words of the hosted fallback on a repository's page, the list and the Overview (github-integration R5.42 to R5.46).

| Where | Word |
|---|---|
| Section | Hosted fallback |
| Choice | When no crsp machine can take these jobs |
| Choices | Wait for a crsp machine, Run on GitHub-hosted runners |
| Help | Waiting costs nothing. Jobs stay queued on GitHub for up to 24 hours. |
| Reason, public | A public repository never runs on GitHub-hosted runners. |
| Fields | Monthly cap of hosted minutes (help: 0 means no cap. Once the cap is reached this month, jobs wait again.), Hosted label for {os} (optional; help: Blank uses {default}.) |
| Note | GitHub may bill these minutes for a private repository. crsp switches back as soon as a machine is up. |
| Button | Save fallback (busy word: Saving) |
| Question card | Title: Run on GitHub-hosted runners? Lines: GitHub may bill the minutes that run on GitHub-hosted runners for a private repository. / Jobs of {repository} run there only while no crsp machine can take them. crsp switches back as soon as a machine is up. Action: Turn on (busy word: Saving) |
| Done | Saved. |
| Column and fact | Jobs go to: crsp machines, GitHub-hosted runners, waiting for a machine, pool off |
| Why | A crsp machine is up. / No crsp machine for {os} is up, so jobs run on GitHub-hosted runners. / No crsp machine for {os} is up. Jobs wait for one. / No crsp machine for {os} is up. Jobs move to GitHub-hosted runners if none comes back soon. / The monthly cap of hosted minutes is reached. Jobs wait for a crsp machine. / A public repository never runs on GitHub-hosted runners. Jobs wait for a crsp machine. |
| Fact | Hosted minutes this month |
| Overview line | {n} repository runs on GitHub-hosted runners because no crsp machine is up. / {n} repositories run on GitHub-hosted runners because no crsp machine is up. |
| Doctor, waiting | Jobs of {repository} wait: no crsp machine is up for {os} |
| Doctor, on hosted | Jobs of {repository} run on GitHub-hosted runners ({os}) |

## Joining a machine, idle and busy, and webhook health words

The words of the Add a machine wizard (machines R5.3a, R5.4a), the runner states (web-console R5.23) and the webhook health of a repository (github-integration R5.50).

| Where | Word |
|---|---|
| Join choice | How the machine joins (help: Copy one command and run it on the machine, let crsp sign in over SSH once, or download a file to open on the machine.): Copy a command, I have SSH, Download an installer |
| Windows note | Copied command: Run the command in an administrator terminal. / Over SSH: A Windows machine needs the OpenSSH server, and the user must be an administrator. |
| SSH fields | Host, User, SSH port, SSH key file (help: Paste the content of the private key file. crsp uses it once for this join and never keeps it. There is no password option; the user needs sudo without a password. On Windows: the user must be an administrator.) |
| SSH errors | Enter the host name or address. / Enter the user name. / Paste the SSH key file. |
| Review facts | System, How it joins (A copied command / Over SSH as {user} on {host} / A downloaded installer), Join code (Lasts 15 minutes and works once) |
| Review lines | crsp signs in once with your key, runs the install command and signs out. The key is not stored. / Next you get one command with the join code in it. Run it on the machine. / Next you get an installer file for this system with the join code in it. Open it on the machine, then delete the file. |
| Join command | Run this command on the machine now. The code shows once. / crsp ran the install command over SSH. Waiting for the agent. |
| Installer saved | The installer is saved as {file name}. It holds a one-time join code, valid 15 minutes. Delete the file after you use it. Then, per system: Windows: On the machine, double-click it and accept the administrator prompt. Waiting for the agent. / macOS: On the machine, open it. If it does not open, run it with sh in Terminal. Waiting for the agent. / Linux: On the machine, run it with sh. It asks for sudo. Waiting for the agent. |
| Installer wait | Making the installer (the wait text while the file is made) |
| Installer failure | Could not make the installer. {reason} |
| Join steps | Waiting for the agent, Agent connected, Machine ready; each says done, in progress or not yet |
| SSH question card | Title: Is this the host key? Line: Host {host} shows the key {fingerprint}. Action: Yes, sign in (busy word: Signing in) |
| SSH failure | Could not join over SSH. {reason} |
| Runner state | idle, busy |
| Runner counts | Idle, Busy, Not ready |
| Runner job | {repository} {job}, running {duration} |
| Repository column and fact | Last delivery: no delivery yet, delivered, delivery failed, delivery missed, no webhook, pool off; Last webhook delivery; Jobs are learned by: webhooks, polling |
| Webhook notes | The GitHub App of this controller has no webhook, so GitHub tells crsp nothing. crsp finds jobs by polling GitHub every 15 seconds, and jobs still run. Nothing needs fixing unless you want jobs to start at once. / GitHub did not tell crsp about a job; crsp found it by polling, so it ran a little late. The webhook of the GitHub App cannot reach this controller. In the GitHub App settings, check that the webhook address is public and starts with https, and look at Recent Deliveries for the red mark. |
| Polling notice | GitHub deliveries to this repository failed {n} times in a row, so crsp now polls GitHub for its jobs. Jobs still run, but they start a little later. |
| Polling button | Switch back to webhooks (busy word: Switching) |
| Polling failure | Could not switch back. {reason} |

## Agent recovery words

The words of the Recovery section and the State word of a machine whose agent needs recovery (operations R5.44, web-console R5.33).

| Word | Where and meaning |
|---|---|
| needs recovery | State word in the State column and in the facts of a machine whose agent needs recovery. |
| Recovery | The section title on the machine page. |
| The agent on this machine is too old to work with the controller. | Problem message when the reason is an old protocol. |
| The agent on this machine was asked to update an hour ago and did not. | Problem message when the agent is stuck on an old version. |
| Agent has, Agent needs, Since | The facts: the version the agent runs, the version the controller runs, and since when (a past time, Dates, times and numbers). |
| Recover | The one action. Admin only (busy word: Recovering). Locked after it worked. |
| Recovery is ready. The agent gets the update on its next call. | Done message after the call, and for a machine that is already armed. |
| Could not start recovery. {why} | Problem message when the call is refused or fails. |

## Offline runner cleanup words

The words of the action that deletes the registration of an offline runner whose machine cannot remove it (github-integration R5.33, web-console 4.5).

| Word | Where and meaning |
|---|---|
| Delete registration | The button in the Managed column of a managed runner whose state is offline, and the action of its question card. Admin only (busy word: Deleting). |
| Delete {runner}? | The title of the question card. |
| The registration of offline runner {runner} on GitHub. | First line of the card: what goes. |
| Its record here, and its folder if its machine answers. | Second line of the card. |

## GitHub App key words

The words of Settings, GitHub App, where the owner replaces the App private key (github-integration R5.7).

| Word | Where and meaning |
|---|---|
| GitHub App | The tab. |
| GitHub App key | The section title. |
| New private key file | The file field. Help: The file you download from the App's page at GitHub. crsp checks it with GitHub first and keeps the old key if GitHub refuses it. |
| Replace key | The one action. Owner only (busy word: Replacing). |
| Choose the private key file from GitHub. | Mistake when no file, an empty file or a file over 16 KiB is chosen. |
| The new key is in use. | Done message after the controller stored the key. |
| Could not replace the key. {reason} | Problem message when the call is refused or fails. The reason never holds the key. |

## Pool per organization words

The words of the section on the repositories screen (github-integration R5.21).

| Where | Word |
|---|---|
| Section | Pool per organization |
| Lead | Organization runners work in one runner group that only the repositories with the pool on can use. Only an owner of the organization on GitHub can turn this on. Personal accounts keep repository runners. |
| Columns | Organization, Runners, Runner group, Repositories in the group, Use organization runners |
| Switch | Organization runners for {organization} (the switch saves at once; words On and Off) |
| Status | organization runners, repository runners |
| Reason, not available | The pool per organization is not available here. / the reason the controller names, for example that the App lacks the organization runner permission |
| Failure | Could not change the pool. {reason} |
| Refusal | you are not an owner of the {organization} organization in GitHub. |

## First machine words

The words of the setup step "Add the first machine" when a machine is already in the pool (machines R5.1, web-console 4.1).

| Word | Where and meaning |
|---|---|
| This PC, {host name}, is in the pool. | Done message when the controller's own machine is in the pool. |
| Add the first machine is done. | Done message when a machine is in the pool and it is not the controller's own. |
| Add another machine | The one action. It opens the Add a machine wizard for other computers. |

## Runner state words

The state word of a runner on the Runners screen (web-console R5.23, runners R5.79; UX-19). A word other than idle or busy shows its reason in a muted line under it.

| Word | Meaning and reason line |
|---|---|
| idle | GitHub lists the runner online and not busy, and its service runs. No reason line. |
| busy | GitHub says the runner has a job. No reason line. |
| not registered | GitHub does not list a runner with this name. Reason: "GitHub does not list a runner with this name". |
| stopped | The service of the runner is stopped or missing. Reason: "its service is stopped" or "its service is not on the machine". |
| offline | GitHub lists the runner offline. Reason: "GitHub reports it offline". |
| unknown | GitHub could not be read. Reason: "GitHub could not be read, so the state is not known". |
| failed | The runner did not start. The reason line is the reason of the failure. |
| Remove | The action on the row of a failed runner (busy word: Removing). Asks first in the question card, which names the runner (UX-9, UX-62). |


## Linux on a Windows machine words

The words of Add runners and the machine list for a Windows machine whose container engine runs Linux containers (runners R5.47, machines R5.18).

| Word | Where and meaning |
|---|---|
| Windows, runs Linux containers | The System column of the machine list for a Windows machine with Docker Desktop on WSL2. |
| Linux runners on this Windows machine run in containers, through Docker. The container backend must be allowed on the machine. | Note in Add runners when the chosen machine runs Windows and the system is Linux. |
| The container backend is not allowed on this machine. Linux runners here need it. | Problem on Add runners step 1 when the system is Linux, the machine runs Windows and the container backend is off. It is also the reason Next is disabled. |
| Allow it on the machine | The button beside that message; it opens the machine page. |
| Nothing would be added with these choices. Change them and try again. | Problem on Add runners step 1 when the plan has no step, so Review is not reached. |
| {reason}. | A refusal of the plan, shown on Add runners step 1 with a full stop, so the user changes a choice. Try again after a failure goes back to step 1 with the reason in the same place. |
| This machine runs windows, not linux. | The reason a machine is greyed for a system it cannot run (also for a Windows machine without Linux containers). |
| WSL is installed but not ready; run wsl --install | Backend reason, shown only when WSL2 does not work and Docker does not run on it. It is written once. |


## List toolbar words

The words of the shared list toolbar (components 11 and 12, CRSP132).

| Word | Where and meaning |
|---|---|
| All | The first choice of a segmented filter. It shows every item. |
| {n} selected | In the toolbar, after Select all N and Clear, when something is selected. |
| {n} repository, {n} repositories | The count in the Repositories toolbar. The same pattern for machine, runner, image, cache and user. |
| Search images, Search caches, Search users | The labels of the search fields of Images, Caches and Users and roles. |
| Pool on, Pool off | The two choices of the Pool filter (with All). |

## Public repositories words

The words of the setting that lets the pool serve public repositories, and of the screens that show it (web-console R5.68 to R5.70, CRSP131).

| Word | Where and meaning |
|---|---|
| Enable for public repositories | The switch in Settings, Repositories. Off by default. |
| Off: the pool serves private repositories only. Keeping repositories private is safer. | Line under the switch while it is off. |
| On: the pool can serve public repositories you turn it on for. Jobs from forks stay refused. | Line under the switch while it is on. |
| Are you sure? | Title of the question card for both directions. |
| Turning this on lets the pool serve public repositories. | Intro of the question card when turning on. |
| Anyone can open a pull request on a public repository. / A self-hosted runner runs that code on your machines. / Jobs from forks stay refused. / Secrets, caches and files on the machine could be reached. / Keeping your repositories private is safer. | The five lines of the question card when turning on. Primary: Turn on. Busy word: Turning on. |
| Turning this off stops the pool for public repositories. | Intro of the question card when turning off. |
| {n} public repositories use the pool now. Their runners are drained and removed, and their pool is switched off. The settings are kept. | The line of the question card when turning off ({n} is public_on_pool; the singular uses repository, uses, Its and its). Primary: Turn off. Busy word: Turning off. |
| No public repository uses the pool now. Nothing is stopped. | The line of the question card when turning off and none is on the pool. |
| The pool was switched off for {n} public repositories. Their settings are kept. | Done message after turning off. |
| Active types: Private (default) / Active types: Private & Public | The line near the title of Repositories. The value links to the setting. |
| Visibility, Private, Public, Internal | The column and its values. |
| Public repositories are off, so the pool does not serve this one. | The reason in a greyed public row. Link: Turn on public repositories. |
| Use pool | Primary action of the action bar on Repositories, for the ticked repositories. Also the action on a repository's page. |
| Stop using pool | Primary action of the action bar on Repositories when every ticked repository already uses the pool. Also the action on a repository's page. |
| Nothing selected | Status line of the action bar on Repositories while nothing is ticked. |
| {n} selected | Status line of the action bar while {n} rows are ticked. |
| Tick the repositories that should use the pool. | Reason of the disabled Use pool while nothing is ticked. |
| Discard changes? | Title of the question when the person leaves an edit screen with unsaved changes. Body: You changed this page and did not save. If you leave now, the changes are lost. Answers: Keep editing, Discard. |
| Changed | The mark on a field whose value differs from what is saved. |
| Unsaved changes ({n}) | Status line of the action bar on an edit screen while {n} things differ from what is saved. |
| Nothing has changed yet. | Reason of the disabled Save in the action bar while nothing differs from what is saved. |
| Change a setting to save. | Reason of the disabled Save on a machine's page while nothing differs from what is saved. |
| Public repositories are off. Turn them on in Settings first. | The reason of a disabled Use pool, and of a repository that Add runners cannot choose. |
| Public repositories are off: {names}. Turn them on in Settings first. | The reason of the disabled Turn on N repositories when the selection holds a public one. |
| {n} public repositories are not listed: public repositories are off. Turn them on in Settings to use the pool there. | Note in Turn on the pool. Action: Open the setting. |
| Fix it | The link in the list from a repository with a Problem to its page. |
| Turn on public repositories, Turn off the pool | The two actions of the Problem of a public repository that uses the pool while the setting is off. |

## First run in the console words

The words of the first-run fixes (web-console 4.1 and 4.3, CRSP124). The console does everything; no step sends the user to a terminal or to GitHub's settings.

| Word | Where and meaning |
|---|---|
| First run is not finished. Next: {step}. | The banner. {step} is connect GitHub, add the first machine or turn on the first repository. The action is Open the setup page. |
| Install the App on a repository | The button that opens GitHub's install page for the App in a new tab. Busy word: Opening GitHub. |
| Install the App on an organization | The same button in Add runners, when the App is on no organization. |
| GitHub is open in a new tab. Pick the account and the repositories there, then come back to this tab. The list refreshes by itself. | Note under the install button after it opened GitHub. |
| GitHub saved the App installation. The list below is read again. Tick the repositories you want and press Use pool. | Done message on Repositories after GitHub's return with setup_action install or update. Action: Use pool. |
| GitHub sent the install request to an owner of the account. The repositories show here when they approve it. | Needs-you message after the return with setup_action request. |
| No repository is waiting. Install the App on a repository to turn the pool on for it, or open Repositories to see the ones that already use it. | Needs-you message in Turn on the pool when no repository is free. |
| Turning the pool on also makes one light runner per system, on a machine that is up. Jobs that last seconds use it, so they do not wait behind a long build. Turn it off for a repository on its page. | Note on the Review step of Turn on the pool. |
| The pool made light runners for short jobs. They show in Runners. | Part of the Done message of Turn on the pool. |
| {n} of these are light runners. The pool made them when you turned it on, one per system, so jobs that last seconds do not wait behind a long build. Turn them off for a repository on its page. | Note in Runners. Action: Open Repositories. |
| {n} runners failed. The State column says why. Remove a failed runner with Remove, then add runners again. | Needs-you message in Runners. |
| Clear search and filter, Clear search and filters | The action of the "hidden by the search" note in Machines and Runners. |
| Tick {backend} | The action that ticks an installed backend that is not turned on (machine page). |
| {backend} is installed and works on this machine, but is not turned on. Tick it and press Save so this machine can run its runners. | Needs-you message on the machine page. |
| {backend} is installed on this machine but not turned on. Open the machine, tick it and press Save to let it run runners. | Needs-you message on Done of Add a machine. Action: Open the machine. |
| Remove this machine | The section of the Remove button, with: "Removing takes the machine and its runners out of the pool. Jobs that run there finish first. The agent stays installed on the machine." |
| Open Machines | The one primary on Done of Add a machine when it is not part of the first-run checklist. |
| Runners are added to one repository. An organization appears here when the App is installed on one. | Note in Add runners when the App is on no organization. |

## Access for CI words

The words of the Settings section Access for CI and of the action that sets up parity for a repository (web-console R5.90 and R5.91, github-integration R5.82 to R5.84, CRSP134).

| Word | Where and meaning |
|---|---|
| Access for CI | The Settings section, and the title of its table. |
| Only an admin can make, see or revoke access for CI. Ask an admin to do it. | Needs-you message for a person who is not an admin. |
| An access for CI is a value a CI job uses to read the pool. It can read the runners and run the doctor, which is all that the parity check needs. It cannot change a machine, a runner, a setting or a user. | Note above the table. |
| No access yet. Set up parity for a repository below, or make one here. | Empty table. |
| Name, Can do, Made by, Made, Last used, State, Actions | The columns. |
| Read only: the checks of parity | The Can do cell. |
| never, live, revoked, Revoked | Last used and State values, and the Actions cell of a revoked access. |
| Revoke | The danger button of a row and of its question card. Busy: Revoking. |
| Revoke {name}? / Access {name} stops working at once. A CI job that uses it is refused. | Title and line of the question card. |
| Make an access | The section of the form. |
| Write a name for the access, such as "parity CI". | Error when the name is empty. |
| What it can do / Parity | The field and its one choice; description: Read the runners and run the doctor, nothing else. |
| Make | The primary button of the form. Busy: Making. |
| Could not make the access. {reason} | Problem message when making fails. |
| Access {name} is made / I have it | Title and close button of the card that shows the value once. |
| This is the only time the value is shown. crsp keeps no copy of it. Copy it now, or revoke this access and make another. | Needs-you message on that card. |
| Access value | Label of the code block that holds the value. |
| Set up parity for a repository | The section of the action. |
| No repository yet. Install the App on a repository first (Repositories). | Empty state of the section. |
| crsp writes the access as the secret CRSP_ACCESS, and its address and certificate fingerprint as the variables CRSP_URL and CRSP_CA_FINGERPRINT, to the repository through the GitHub App. You copy nothing. The parity workflow reads them. | Note of the section. |
| Repository | The field that chooses the repository. |
| Set up parity for this repository | The primary button. Busy: Setting up. Reason when none is chosen: Choose a repository first. |
| Could not set up parity. Nothing was left behind. {reason} | Problem message when the setup fails. |
| Parity is set up for {repository}. The workflow can run now. | Done message. |
| The GitHub grant | See GitHub grant words: a missing App permission is shown by the shared part, not by words of this screen. |

## Docker disk words

The words of the Docker disk section on the machine page (caches R5.51 to R5.54, machines R5.66). The section shows only for a machine whose agent found a Docker Desktop disk file, or whose choice is On or Off.

| Word | Where and meaning |
|---|---|
| Docker disk | The section title on the machine page. |
| Make Docker's disk smaller | The name of the one-choice list. Values: Automatic, On, Off. Saved at once. |
| On for a Windows machine with a Docker Desktop disk file. Off for the others. | Help under Automatic. |
| Makes the disk smaller when the numbers below say so. | Help under On. |
| Never makes the disk smaller by itself. | Help under Off. |
| Start when this much can be reclaimed | The name of the number field, in GiB. The default is 30. |
| Wait until the machine has been idle for | The name of the number field, in minutes. The default is 30. |
| No job runs or waits for its runners. | Help under the idle field. |
| Quiet hours start, Quiet hours end | The names of the two hour lists. Defaults 01:00 and 06:00. |
| In the machine's own time. | Help under Quiet hours start. |
| At most once a day. New jobs wait in the queue while the disk is made smaller. No job is stopped. | The note at the end of the section. |
| Now | The facts line with the state word. |
| Disk file, Docker uses, Can be reclaimed, Last time | The other facts lines. Sizes as in Dates, times and numbers. Last time is a date, a time and the sizes, or the failure. |
| Making the disk smaller | State word while the compact runs. |
| Off | State word: the policy is off for this machine. |
| Done today | State word: it ran in the last 24 hours. |
| Waiting for quiet hours | State word: outside the quiet hours. |
| Waiting: the machine is offline | State word. |
| Waiting: the machine is paused or not taking jobs | State word. |
| Waiting for the agent to look at the disk | State word before the first report. |
| Waiting: less than the limit can be reclaimed | State word. |
| Waiting: jobs run or wait here | State word. |
| Waiting: not idle long enough | State word. |
| Waiting: another change is running | State word. |
| Cannot: the agent has no administrator rights | State word, shown as a failure. |
| Not looked at yet | State word when no look was made. |
| The agent on this machine does not run as administrator, so it cannot make Docker's disk smaller. Install the agent again from an administrator window, or turn this off. | Problem message under the facts. |
| Turn off | The action beside that message. Saves Off. |
| Could not save. {why} | Problem message when a change was not saved. |
| {machine} is making Docker's disk smaller ({size} on disk, {size} used). New jobs wait in the queue and start again when it is done; no job is stopped. | Notice to the projects, before. |
| {machine} made Docker's disk smaller: {size} to {size}. Jobs take the machine again. | Notice to the projects, after. |
| {machine} could not make Docker's disk smaller: {why}. Jobs take the machine again. | Notice to the projects, on a failure. |

## GitHub grant words

The words of the shared part that guides a missing App permission or repository access (github-integration R5.86, web-console R5.93, CRSP139). Permission words: Secrets (write), Variables (write), Administration (write), Actions (read), Contents (read), Metadata (read), Organization runners (write).

| Word | Where and meaning |
|---|---|
| The GitHub App needs {permissions}. Nothing is lost: do the steps below, one at a time. | Needs-you message above the step list. |
| Install the App on the account | Label of the install step. Text: Pick the account and the repositories on GitHub. Done: The App is installed. |
| Ask for {permissions} on the App page | Label of the ask step. Text: On the App page, under Repository permissions, set the access to Read and write. Done: The App asks for it. |
| Accept the new permissions on the installation: {permissions} | Label of the accept step. Text: On the installation page, press Accept new permissions. Done: The installation accepted it. |
| done, missing | The state word of a step. |
| Do this after the step above. | Text of a missing step that is not next. |
| Install the App on GitHub, Ask for it on GitHub, Accept it on GitHub | The one primary action; it opens the page of the next missing step in a new tab. |
| GitHub is open in a new tab. Do the step there, then come back to this tab. It checks again by itself. | Note after the action is pressed. |
| Checking GitHub. | Note while it reads GitHub. |
| Could not check GitHub. {reason} | Problem when the check fails; the next check tries again. |
| Ready. {permissions} granted. | Done message when everything is granted. |

## Update dialog words

The dialog the tray opens when a newer stable release is found (tray R5.43, operations R5.87, CRSP147). It stays until answered. The buttons are Later and Install now, and the link is What changed (action vocabulary).

| Word | Where and meaning |
|---|---|
| Updated to {version} | Tray notice, once per version, after a successful update. |
| CI Runners Shared Pool {version} is the newest stable release. | Tray notice when Look for updates finds nothing newer. |
| Install now waits for the {n} running jobs to finish. It stops none. | Line of the dialog when jobs run; names how many. |

## GitHub error words

The words of the repositories page when the list is the last copy because the read from GitHub failed (github-integration R5.89 and R5.89, web-console, CRSP148). Say what GitHub really said (UX-28).

| Word | Where and meaning |
|---|---|
| Your GitHub sign-in ended. Sign in with GitHub again to refresh the list. | Needs-you message; the sign-in is memory-only and ended, GitHub itself is fine. |
| GitHub could not be reached. | Needs-you message when no answer came. |
| GitHub refused ({status}): {message}. Grant the permission in the guide below. | Needs-you message when a permission is missing. |
| GitHub answered {status}: {message}. | Needs-you message for any other GitHub error, with GitHub's own status and words. |
| The list could not be refreshed. | Needs-you message when no reason is known. |
| The list is the last copy, from {when}. | Second sentence of each message above; without a time: The list is the last copy. |

## Network words

The words of Settings > Console > Network and of the dialog that chooses the controller address (operations R5.90, OPS14). Also opened from the Needs-you box of Access for CI.

| Word | Where and meaning |
|---|---|
| Network | Section title. |
| Choose an address | Primary action in the section and in the Needs-you box; opens the dialog, and is its title. |
| Use this address | Primary action of the dialog; busy word Saving, then Restarting. |
| Listening on | Fact: the address the controller listens on now. |
| Chosen, after the next restart | Fact: the stored choice is not yet the running address. |
| This PC's network address | Choice (recommended), with its address on line 2; description: Runners and machines on your network, and containers on this PC. |
| Docker and WSL on this PC only | Choice: containers and WSL on this PC, no other machine. |
| Another address | Choice: opens the box Address as host:port. |
| Address as host:port | Box label; help: an address of this PC, port 8460 unless written. |
| The controller restarts once when you press Use this address. Running jobs finish first. | Line in the dialog. |
| Waiting for running jobs to finish, then the controller restarts on {address}. No job is stopped. This page reopens here when the controller answers. | Note while it waits. |
| The controller answers on {address}. It also keeps 127.0.0.1 for this console and the tray. | Done. |
| This address is set by CRSP_LISTEN_ADDR on this PC, so it cannot be changed here. | Note when the environment decides. |
| Could not use this address. {reason} | Problem when the address is refused. |
| The controller did not listen on the new address. {reason} | Problem when it restarted but could not bind. |
| Add this sign-in address to your GitHub App | Title of the guided step, in the dialog before the switch (github-integration R5.8, OPS16). |
| GitHub only signs people in on addresses the GitHub App knows. It does not know this one yet. Add this callback URL to the App: copy it, open the App's settings on GitHub, and under Callback URL choose Add Callback URL. | Text of the guided step, with the box Callback URL (Copy) and the action Open the App on GitHub. |
| Callback URL | Label of the copyable box. |
| Open the App on GitHub | Link button to the App's settings page, github.com only. |
| When you have added it, press Try again. The controller then tries a sign-in for {address} and switches to it. Until then it stays on {address}. | Line in the guided step; Try again is the primary action, busy word Asking GitHub. |
| GitHub does not know this address yet. Pressing Try again before you added it changes nothing. | Note in the guided step. |
| Could not check the address. {reason} | Problem when GitHub could not be asked. |
| Sign-in does not work on {address} yet. Open the console on the PC that runs it at http://127.0.0.1:8460, or add this address to the GitHub App. | Needs-you message on the sign-in page; the guided step follows and the action is Try again. |
| {login} is not on the list. Ask the owner to add you. | Problem message on the sign-in page, code not_allowed (github-integration R5.11, OPS17). |
| The sign-in took too long or was already used. Try again. | Problem message on the sign-in page, code state_missing (github-integration R5.8, OPS17). |
| The sign-in started on another address. Try again from this address. | Problem message on the sign-in page, code state_mismatch (github-integration R5.8, OPS17). |
| Sign-in does not work on this address. Use https, or http://127.0.0.1 on the PC that runs the controller. | Problem message on the sign-in page, code address_refused (github-integration R5.8, OPS17). |
| GitHub did not accept the sign-in. Try again. | Problem message on the sign-in page, code exchange_failed (github-integration R5.8, OPS17). |
| GitHub did not say who you are. Try again. | Problem message on the sign-in page, code user_failed (github-integration R5.8, OPS17). |
| The controller could not start your session. Try again. | Problem message on the sign-in page, code session_failed (github-integration R5.8, OPS17). |
| The sign-in could not return to the address you started on. Try again. | Problem message on the sign-in page, code handoff_failed (github-integration R5.8, OPS17). |
| This controller has no GitHub App yet. Open the setup page to create it. | Problem message on the sign-in page, code no_app (github-integration R5.8, OPS17). |
| The OS secret store is not available. See the doctor. | Problem message on the sign-in page, code secret_store_unavailable (github-integration R5.8, OPS17). |
| Sign-in failed. Try again. | Problem message on the sign-in page, code sign_in_failed (github-integration R5.8, OPS17). |

## Repositories list: groups and inactive types

The words of the Repositories screen when the list is grouped by owner and hides repositories of an inactive type (web-console, LOOK5; owner decisions LOOK D15 and D16). Active types today: Private.

| Word | Where and meaning |
|---|---|
| {owner} | Group heading row, with a tick box that selects the whole group. |
| {n} repositories · {m} use the pool | Under the owner; `1 repository` when n is 1. |
| {n} public repositories are not listed: the pool serves private repositories only. | Note line above the list while public repositories are not an active type. |
| List them too | Link in the note: shows them, in grey, in their groups. |
| Change active types | Link in the note: opens the active-types setting. |
| {n} public repositories are listed in grey: the pool serves private repositories only. | The note line while they are listed. |
| inactive type | Tag after Public on a listed public repository that is not an active type (UX-70). |
| Hide them | Link in that line: lists private repositories only again. |
| {n} private repositories | Count beside the toolbar; `{n} private & public repositories` when public is active or listed. |

## Ordered list words

| Word | Where |
| --- | --- |
| Move {item} up | Name of the icon button ↑ on a row. |
| Move {item} down | Name of the icon button ↓ on a row. |
| {item} moved to place {n} of {total}. | Live line after a move. |

## Account menu words

The words of the account menu at the top right and of the Users and roles intro (web-console R5.95, LOOK15).

| Word | Where and meaning |
|---|---|
| GitHub sign-in: active until {HH:MM} | Menu line while the GitHub sign-in holds; the time is local. |
| GitHub sign-in: active | The same line when no end time is known. |
| GitHub sign-in: ended | The same line, amber status, after a restart or the 8 hours. |
| Sign in with GitHub again | Action in the menu when ended: signs out, then asks GitHub, then returns to this page. |
| Opening GitHub | Busy word of that action. |
| GitHub sign-in ended | Accessible label of the amber dot on the account button. |
| Who may use this console. Your own GitHub sign-in is in the {login} menu at the top right. | Intro line of Users and roles. |

## Update page words

The words of the small update page the tray opens (tray R5.43, web-console R5.96). The page is the shared wizard (component 4); the steps follow UX-30.

| Words | Used for |
|---|---|
| Update | Title of the page and name of the wizard. |
| Version {version} is ready. Running jobs finish first; the service restarts (about 1 min). | The Review line. It is also the text of the native fallback box. |
| Update now | The primary on Review. Busy word: Updating. |
| Not now | The left button on Review: nothing starts. |
| Running jobs are safe. | Line under the progress bar while the update works. |
| Hide | Closes the window while the update goes on. It stops nothing. |
| Downloading, Waiting for jobs, Installing, Restarting | The work steps, in the order the service goes through them. |
| Downloading {n}%, Waiting for running jobs to end, Installing {n}%, Restarting the service | The live line of the current step. |
| The service is restarting. This page waits for it. | Note while the service is down for the install. |
| Updated to {version}. | The Done message. |
| Close | The primary on Done, and the left button after a failure. |
| Open Updates | The left button on Done: opens Settings, Updates. |
| The update did not finish. {reason} The running version stays. The log is {path}. Open the log folder from the tray menu. Then try again. | The failure message. |

## Shared Pool and Jobs words

The words of the six-item menu, Shared Pool and the Jobs sub-sections (owner decisions D24, D29, D31 to D34, LOOK31). "Runners" stays "runners" (D29).

| Word | Where and meaning |
|---|---|
| Shared Pool | Menu area and page title: the one pool of machines and their runners. |
| Summary, Machines, Runners, Images and caches, Size and backends | The tabs of Shared Pool. |
| All, By repository, By machine, By runner type, By job type, Wait and duration | The tabs of Jobs. |
| One pool across your machines. Set it up here, then choose the repositories that use it. | Lead of the Shared Pool summary. |
| Set up the pool | Title of the first-run guide. |
| Three steps. A step opens when the one before it is done. | Hint of the first-run guide. |
| 1 Add a machine / 2 Set runners / 3 Choose repositories | The steps of the guide; each shows `done, {n} ...` when finished. |
| Add a machine first. | Reason on a step or button that cannot start yet. |
| {n} machines, {m} runners, {k} busy | The pool totals above the runner list and on the summary. |
| Runners serve every repository that uses the pool. | The one line on Add runners, in place of the Repository question. |
| How crsp works: the Pool has Machines, and each machine has Runners. Repositories use the pool. Start in Shared Pool. | The first-run strip on the Overview. |
| Hide this | Button that hides the strip for good in this browser. |
| Showing the last 100 finished jobs. | Note above the finished jobs when more exist. |
| See all | Button that pages in the earlier finished jobs. |
| Done, failed and the averages count the last 200 finished jobs. | Quiet line under a grouped Jobs table. |
| not placed yet | Group name of a job that has no machine or runner yet. |
## Runner service words

The words of a runner service that did not start (runners R5.89, web-console R5.98, tray R5.44, doctor R5.45). The agent has already given the service account the right to log on as a service again and tried twice.

| Where | Word |
|---|---|
| Banner (problem) | {runner} on {machine} did not start. {reason} |
| Banner and Doctor action | Start. It asks that machine's agent to give the account the right again and start the service. Busy word: Starting. Disabled for a user who is not an admin, with the reason. |
| Tray notification title | A runner did not start |
| Tray notification text | {runner} did not start. {reason} Open the console and press Start. |
| Doctor finding, the right is missing | The account {account} of {runner} cannot log on as a service |
| Doctor finding, the service is stopped | The service {service} of {runner} is not running |
| Doctor finding, fine | {account} can log on as a service and {runner} runs |
| Doctor fix | Press Start. The agent gives the account the right to log on as a service again and starts the service on {machine}. |
## Webhook settings words

The words of Settings > Access > Webhooks and the link on the repository page (github-integration R5.51, web-console R5.99, OPS25).

| Word | Where and meaning |
|---|---|
| Webhooks | Section title; the name of the state line. |
| on / off / failing | Status words of the state: on, off, failing (the newest delivery failed or was missed). |
| Real webhooks | Check box. Help: "Clear it and Save to find jobs by polling GitHub again." |
| Public https address | Field name; help: "The address that forwards to this controller, for example https://hooks.example.com. crsp sends a signed test to it before GitHub is changed." |
| With webhooks GitHub tells crsp about a job the moment it is queued, so the job starts at once. Without them crsp asks GitHub for new jobs every 15 seconds, so a job can start up to 15 seconds late. Webhooks need an address GitHub can reach: a tunnel or a reverse proxy with a real certificate. A LAN address or a self-signed certificate does not work. | The explanation at the top of the section. |
| Testing the address | Busy word of Save while the address is tested; Turning off is the busy word when the box was cleared. |
| Webhooks are on. GitHub now tells crsp about jobs at once. | Done line after Save. |
| Webhooks are off. crsp finds jobs by polling GitHub again. | Done line after turning off. |
| Could not save the webhook. {reason} | Problem line; the reason is the controller's own plain words. |
| The address must start with https://. GitHub does not send webhooks to plain http. | Mistake in the list. |
| {host} is a local address. GitHub can only reach a public address, such as a tunnel or a reverse proxy with a real certificate. | Mistake in the list. |
| Write the public address that forwards to this controller. | Mistake when the field is empty. |
| This is not a web address. Write it like https://hooks.example.com. | Mistake. |
| Write the address without a user name, a query or a #fragment. | Mistake. |
| The App does not listen for workflow jobs yet. On GitHub, open the App's permissions page and under Subscribe to events tick Workflow job, then save. Jobs are learned by webhooks once you have done that. | Guided step; its button is Open the App on GitHub. |
| Turn on webhooks | Link at the end of the repository note "no webhook"; goes to Settings > Access > Webhooks. |


## Runner kind words

The words of Add runners step 1, the Runners list, the runner page and the Repositories page for the kind of a runner (runners R5.89 to R5.92, github-integration R5.60, web-console R5.101, R5.102; owner decisions D93, D94, D95, 2026-11-18).

| Word | Where and meaning |
|---|---|
| Kind | The label of the one-choice list on Add runners step 1. |
| Persistent | Choice. Line under it: Keeps its tools and caches between jobs. Starts jobs faster. |
| Ephemeral | Choice. Line under it: A fresh container for every job. Nothing carries over. Recommended for public repositories. |
| Ephemeral is chosen because a public repository uses the pool. | The one line under Kind while no one has picked and a public repository has the pool on. |
| Persistent is chosen because no public repository uses the pool. | The same line when no public repository has the pool on. |
| {Kind} is chosen because {Other kind} is not offered here. | The same line when the preferred kind cannot run on the machine for the system. |
| Ephemeral needs the container backend, which is not allowed on this machine. | Reason of the greyed Ephemeral choice. "which does not work on this machine" when the backend is allowed but not usable. |
| Persistent Linux runners on this Windows machine need the container backend, which is not allowed on this machine. | Reason of the greyed Persistent choice for Linux on a Windows machine. |
| Ephemeral runners are not available for Windows yet. Windows runners are persistent. | Reason of the greyed Ephemeral choice for Windows. The same for macOS with its name. |
| The container backend decides which kinds this machine offers. | Note with the button Allow it on the machine, shown while a kind is greyed for the container backend. |
| Keep downloaded dependencies | Check box on Add runners step 1 for a persistent runner (on by default) and on the runner page. |
| Temporary files of each job are always removed. | Help line of that check box. Not a setting. |
| Most ephemeral runners at once | Label of the count for an ephemeral runner. Help: The pool makes a fresh container for each job, up to this many at the same time. |
| Allow {n} ephemeral runner(s) | The primary of Review for ephemeral runners (busy word: Registering). |
| {n} persistent runner(s) on {machine}. | Review text, then the dependency sentence: Downloaded dependencies are kept between jobs. / Downloaded dependencies are removed after each job too. / Each job gets a fresh container (ephemeral: Up to {n} ephemeral runner(s) at once on {machine}.). |
| Persistent. Keeps dependencies: yes | Third line of the Isolation cell in the Runners list. Ephemeral shows Ephemeral only. |
| Dependencies | Section of the runner page for a persistent runner. |
| Dependency cache size | Fact of the runner page. Not measured yet when the controller has no size. |
| Clear now | Button of the runner page (busy word: Clearing). |
| A job is running. Clearing waits for it to finish. | Line under Clear now while the runner is busy. |
| not clean | State word of a runner whose clean-up failed. |
| Not clean: {reason}. It takes no new job until it is clean. | The runner's problem on its page and the full text of the State cell. |
| Runner kind | Column of the Repositories list, fact and field of a repository. Choices: Use the default ({Ephemeral only or Any runner}), Ephemeral only, Any runner. |
| Ephemeral only (default) | Value while the owner has not chosen; the default is Ephemeral only for a public repository, Any runner for a private one. |
| Jobs from a public repository can then run on a persistent runner, which keeps files between jobs. Anyone who can open a pull request may reach it. | Warning under the field when a public repository is set to Any runner, and the body line of the question card Let public jobs use persistent runners? (answer Allow). |
| No ephemeral runner capacity: jobs would wait. | Line in the Runner kind column and a Problem on the repository page with the button Add runners, while the pool has no machine that can make an ephemeral runner. |
