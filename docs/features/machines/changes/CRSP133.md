---
change: minor
task: CRSP133
---
The join file is saved owner-only on every system: a protected access list for the current user and SYSTEM on Windows, mode 0600 elsewhere (R5.65). The file and the console say the code is one-time and to delete the file after use. The downloaded installers (`.cmd`, `.sh`, `.command`) and the SSH join to Windows (R5.3a) now pin the controller's certificate by the fingerprint of the join command, instead of skipping the TLS check; the GitHub fallback keeps normal TLS. The Windows access list and the PowerShell pin were built and vetted for Windows but not run on a real Windows machine.
