# CRSP109 report: symlink probe in the agent

Status: started.

Plan
- proto: `SymlinkReport` in `MachineReport` (known, can_link, developer_mode, error).
- agent: `ProbeSymlink` makes a link in a temp dir (no OS setting changes); Windows reads Developer Mode with `reg query`; other OSes always yes. Injectable through `Config.Symlink`.
- doctor: `doctor.SymlinkProbeFrom` maps the report to `SymlinkProbe`.
- docs: Built text for doctor R5.42 and runners R5.68; change notes.

Not done (outside agent and doctor areas): reading the report into `doctorFleet.Runners` in `cmd/crsp`.
