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

## Hosted fallback words

The words of the hosted fallback on a repository's page, the list and the Overview (github-integration R5.40 to R5.44).

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
