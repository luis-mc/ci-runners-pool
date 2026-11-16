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
| Hide | Stop showing something. It is kept. | Dismiss, Close |
| Show | Show something that was hidden. | Reveal, Unhide |
| Open | Go to an item to see it. | View, Go to |
| See all N | Go from a preview to the whole list. N is the count. | More, View all |
| Back | Go to the step before. | Previous |
| Next | Go to the step after, when it is not the last step. | Continue, Forward |
| Done | The last step of a wizard: what really happened, never the plan. Its one primary is the next action. | Finish, Finished, Complete, Result, OK |
| Search | Look for text in a list. | Find, Look up |
| Sort | Order a list by a column. | Order, Arrange |
| Sign in with GitHub | Start the GitHub sign-in. | Log in, Login |
| Sign out | End the session. | Log out, Logout |
| Drain | Stop a machine taking new jobs and wait for the running ones. | Pause, Disable |
| Resume | Let a drained machine take jobs again. | Enable, Undrain |
| Turn on | Let a repository use the pool. | Enable, Activate |
| Turn off | Stop a repository using the pool. | Disable, Deactivate |
| Copy | Copy a command or a value. It changes nothing. | Clipboard |
| Look for updates | Ask GitHub for a newer stable release now. It downloads nothing. | Check for updates, Refresh |
| Update to N | Install release N after the running jobs end. N is the version. | Upgrade, Install |
| Restart the service | Stop and start the service after the running jobs end. | Reboot, Reset |
| Automatic updates | The switch that lets a newer stable release install by itself after the running jobs end. | Auto-upgrade |
| Quit tray | Close the tray icon only. The service keeps running. | Exit, Close |
| Export | Save every row of a table or list as a file, in the order shown (component 29). It changes nothing. | Download, Save as |
| Run the doctor | Start the doctor now. While it runs the button says Running the doctor. | Scan, Check, Run checks |
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

A step that only reads before Review is named by what it reads ("Reading files", "Reading folders"). It changes nothing. It is never called "Checking".

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
| Cache kinds | Tool cache, Rust build cache, Actions cache, Git mirror, Registry mirror |
| Empty images | No images yet. Images are built when a runner first needs one. |
| Empty caches | No caches yet. Caches show here when a runner has been added. |
| Question title | Wipe {cache}? Rebuild the image of {machine}, {OS}? |
| Wiping | Wiping {cache}, waiting for {jobs} |
| Last wiped, none | never |
| No cap | {size}, no cap |
| Over the cap | {size} of {cap} ({percent}), over the cap |
| Wipe failed | Could not wipe {cache}. {why} |
| Rebuild failed | Could not rebuild. {why} The old image keeps serving. |
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
| Taking jobs | State word: the machine takes new jobs. |
| Paused, On battery, Quiet hours | State words: why the machine takes no new job. |
| Busy | State word: the load is over the budget, so a new job waits. The tray header does not say it. |
| Now | The facts line with the state word. |
| Paused until | The end of a pause from the tray with a timer. A date and time (Dates, times and numbers). |
| Until you resume | The value of the fact Paused for a pause from the tray that has no end. |
| Power | The facts line. Values: On battery, On mains. Shown only when the machine's battery state is known. |
| Pause on battery | The switch. Saved at once. |
| Always ignores the battery. | The note under the switch in Always. |
| Off: the machine keeps taking jobs on battery. | The note under the switch when it is off. |
| On: Automatic takes no new job while the machine runs on battery. | The note under the switch when it is on. |
| CPU for runners | The name of the CPU cap list. Values: 25%, 50%, 75%, 100%. |
| The most CPU the runner processes may use. The load budget stays as it is. | The help under the CPU cap list. |
| Not supported on macOS yet. The runners use all the CPU. | The help under the CPU cap list on macOS. |
| Not supported on macOS yet. | The reason on each CPU cap value on macOS. |
| The CPU cap was not set. {why} | Problem message when the agent could not set the cap. |
| It takes no new job. The jobs that run finish. | Note under the state when the machine is paused. |
| It takes no new job while it runs on battery. The jobs that run finish. | Note when the machine is on battery. |
| It takes no new job in quiet hours. The jobs that run finish. | Note in quiet hours. |
| Its load is over the budget. A new job waits until the load drops. | Note when the state is Busy. |
| Could not save. {why} | Problem message when a change was not saved. |
| Could not change the mode. Could not pause. Could not resume. | Titles of the tray notice when a menu change failed. |
| This service cannot change the mode. Open the console and go to Machines. | Tray notice for a service that does not report a policy. |
| waits because its machine is paused, waits because its machine runs on battery | Job wait reasons on the jobs screen. |

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
| Machine drained | The machine is drained. |
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

## Pool size words

The words of the Pool size wizard on a machine's page (machines R5.58). The wizard is the shared wizard (component 4); the steps follow UX-30.

| Where | Word |
|---|---|
| Section | Pool size |
| Steps | Size, Review, Saving, Done |
| Loading | Reading the budget of {machine} |
| Fact names | Pool size now, Memory of the machine, Used outside the pool, Memory budget, Room for the pool, CPU budget, Decided by, Asked for |
| Not set | not set |
| Budget not known | Budget: not known yet; Review says when it is |
| Fields | Pool memory (help: Memory the pool may use on this machine, in GiB.), Pool CPUs (help: CPUs the pool may use on this machine.) |
| Mistakes | The pool needs at least {n} GiB. The pool needs at least {n} CPUs. This is the size that is set now. Change it to review. |
| Review line | The pool of {machine} changes from {size} to {size}. |
| Fits | This size fits the budget of the machine. |
| Does not fit | This size does not fit the budget. {reason} |
| Nearest | The nearest sizes that fit: |
| Cannot check | The size cannot be checked yet. {why} Try again when the agent has reported. |
| Lower size | This lowers the pool size. Jobs that need more than the new size wait or fail to start. |
| The tick | Yes, lower the pool size |
| Primary | Save {memory} and {cpus} (busy word: Saving) |
| Reasons beside the primary | Reading the budget. The size cannot be checked yet. This size does not fit. Go back and change it. Tick the box to confirm lowering the pool size. |
| Saving line | Saving the pool size of {machine} |
| Paused | Paused. The page closed while the size was saving. Start again to read the size that is set. |
| Done | The pool size is {size}. |
| Stopped | Stopped. Nothing was saved. The pool size changed to {size} while you reviewed. |
| Failed | The pool size was not saved. {why} Try again. |

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
| Join choice | How the machine joins (help: Copy one command and run it on the machine, or let crsp sign in over SSH once.): Copy a command, I have SSH |
| Windows note | A Windows machine joins by copying a command. Run it in an administrator terminal. |
| SSH fields | Host, User, SSH port, SSH key file (help: Paste the content of the private key file. crsp uses it once for this join and never keeps it. There is no password option; the user needs sudo without a password.) |
| SSH errors | Enter the host name or address. / Enter the user name. / Paste the SSH key file. |
| Review facts | System, How it joins (A copied command / Over SSH as {user} on {host}), Join code (Lasts 15 minutes and works once) |
| Review lines | crsp signs in once with your key, runs the install command and signs out. The key is not stored. / Next you get one command with the join code in it. Run it on the machine. |
| Join command | Run this command on the machine now. The code shows once. / crsp ran the install command over SSH. Waiting for the agent. |
| Join steps | Waiting for the agent, Agent connected, Machine ready; each says done, in progress or not yet |
| SSH question card | Title: Is this the host key? Line: Host {host} shows the key {fingerprint}. Action: Yes, sign in (busy word: Signing in) |
| SSH failure | Could not join over SSH. {reason} |
| Runner state | idle, busy |
| Runner counts | Idle, Busy, Not ready |
| Runner job | {repository} {job}, running {duration} |
| Repository column and fact | Last delivery: no delivery yet, delivered, delivery failed, delivery missed, pool off; Last webhook delivery; Jobs are learned by: webhooks, polling |
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

