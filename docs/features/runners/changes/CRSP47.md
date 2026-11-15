---
change: minor
task: CRSP47
---
Each persistent runner now sets `RUSTUP_HOME` and `CARGO_HOME` under its own folder (`cache/tools/rustup` and `cache/tools/cargo`), so two runner accounts never share a toolchain (R5.56). Setup logs go through one redactor that knows every one-time token and the shapes of GitHub tokens, keys and headers, and the setup log file is owner-only (R5.11).
