---
change: minor
task: REG7
---
Replace and rollback are built (R5.53 to R5.58): compare of a new image with the one it replaces, a replace plan that is a draft until start, start moves only the pointer of the repository the image was built for and asks the machines that held the old image to pull the new one, then marks the old image superseded for the keep days (it stays for other repositories that point at it), stop ends after the current step, rollback moves the pointers back until keep_until and answers 409 after it. The plan is kept in registry_replace_plans, so a reload or a controller restart shows it as it was.
