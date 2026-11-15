---
change: minor
task: OPS5
---
The MSI names the product "CI Runners Shared Pool" in the Start Menu and in the Apps list (it said "crsp"), and shows the CRSP disc icon there. The service name, folders, Run key name and UpgradeCode are unchanged, so an upgrade over an older install still works. OPS6: after a successful interactive install or upgrade the MSI starts the tray for the installing user, not elevated, instead of waiting for the next sign-in (R5.36).
