# CRSP133 report

Branch CRSP133-joinfile-tls. Status: started.

## Plan
1. Owner-only save of the join file on every OS (Windows protected DACL: current user + SYSTEM). Test reads DACL back.
2. File and console say: one-time code, valid 15 minutes, delete after use.
3. Pin the controller certificate (CA fingerprint, as the copied command's `--fingerprint`) for the MSI/package downloads: PowerShell callback (5.1 safe) in sshwin.go and the `.cmd` template; openssl chain check + curl `--pinnedpubkey` in the `.sh` and `.command` templates. GitHub fallback keeps normal TLS.
4. Spec R5.3a, R5.65 text and test rows; change note.

## Notes
- The pin is the CA fingerprint (tlsca.VerifyPin): a certificate in the presented chain has it and the server certificate chains to it.
- In the SSH path SHA256SUMS never travels to the machine: the controller reads it and puts the MSI hash in the script. Only the MSI download needs the pin.
