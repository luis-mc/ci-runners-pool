# HND23 report

Built: `persistent.SessionGuard` (quiet back-off inside window, fault past it, start only through the listener guard), `settings.GetSessionWait/UpdateSessionWait` (`session_wait_minutes`, default 3), doctor `runner.listener` ok inside window / warn after / fail on two listeners. Specs: runners R5.67, doctor R5.41, change notes HND23.

Not built: no supervisor loop exists in this repo to wire the guard into (container runner script is `exec ./run.sh`; images hold no supervisor scripts), and the agent does not fill `SessionRefused`/`RestartedAt` (open question 55). Setting has no API/screen.

Checks: go test -race (persistent, doctor/..., settings) green; gofmt clean; go vet green. GOOS=windows go vet green. golangci-lint could not run (binary built with go1.25, repo targets 1.27.4). No shell changed, so no shellcheck. `docs_check.py` not available here.
