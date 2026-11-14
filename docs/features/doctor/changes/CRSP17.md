---
change: minor
task: CRSP17
---
RunChecks is a command on the agent Session stream (RunChecks, then CheckResults) instead of a server-to-agent RPC, because the agent only dials out (decision 0004). The doctor starts in M1 with the core checks (owner decision); runDoctor, getDoctorRun and listDoctorFindings are in the M1 contract.
