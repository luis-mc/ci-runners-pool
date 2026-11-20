# CIX16 report: agent CPU and memory sampling per job, link v4

Branch CIX16-job-sampling from CIX-integration (6b2697f). Plan row 6 (plan id CIX14).

## Built (per requirement)
- R5.19 sampling: `internal/agent/jobsample`: `CgroupSampler` (cgroup v2 cpu.stat usage_usec + memory.current), `ProcessTreeSampler` (sum over the tree under RootPID, `ProcFS` reads /proc/<pid>/stat), `Collector` (sample per tick, batch every 15 s, final batch on Finish, Forget hook, Enabled gate, Run over a ticks channel). A value it cannot read gives `Known=false` and a reason, sent as `unknown_reason`; sampler errors never fail a job.
- R5.19 link, agent: `internal/agent/jobsample_link.go`: `HelloAckHasJobSamples` (ack version >= 4), `JobSampleSender` (Attach(send, supported) / Enabled / Send). On a v3 ack nothing is sent (tested).
- R5.19 link, controller: `internal/agentlink/insights.go` `JobSampleSink` + `ResourceSink` (stores through `capacity.Resources.Add`, drops a batch with no GitHub job id). `internal/machines/link.go`: `Hooks.OnJobSamples`, the one `SessionRequest_JobResourceSamples` case, and HelloAck version 4 when `Registry` and `OnJobSamples` are both set.
- R6.4: BenchmarkSample (200x): cgroup 580 ns/op; process tree over 500 processes 80 us/op. One sample per 5 s per job: well under 0.01 percent of one core. Wire: one sample is under 30 bytes, 3 per 15 s, so far under 1 KiB/s.

## Tests and times
- `go test -race -count=2` jobsample, agentlink, machines (-run JobSamples), agent (-run JobSample|HelloAckHasJob): each package ~1 s.
- golangci-lint on internal/agent, agentlink, machines: 0 issues. go vet clean. Test guardrails: no break from my files (existing table tests over 20 rows are not mine).
- docs_check: only the expected W1.

## Contract gaps (questions for the orchestrator)
1. Wiring not in my row: `internal/agent/run.go` must (a) call `JobSampleSender.Attach(l.send, HelloAckHasJobSamples(ack))` after HelloAck and detach on session end, (b) start a `jobsample.Collector` (Enabled = sender.Enabled, ticks every `jobsample.Interval`) and call `Start`/`Finish` where jobs take and release slots, with Target built from the runner (CgroupPath or RootPID). Also the Hello still says PROTOCOL_VERSION_3; the ack decides, so no change is needed there. Workaround: all parts are tested alone.
2. Controller wiring (cmd/crsp): `Hooks.OnJobSamples` = `agentlink.ResourceSink{Resources: ...}.JobSamples` once CIX13 implements `capacity.Resources`. Not wired by me.
3. HelloAck is version 4 only when `Hooks.Registry` is also true: the agent's registry check is "version >= 3", so a v4 ack without registry would make agents ask the registry. If registry-less controllers must sample, the registry check needs a separate flag (protocol change; I did not make it).
4. `JobRef.github_job_id` may be 0 when the runner has not yet learned its job id; such batches are dropped by `ResourceSink`. Alternative would be matching by repository/run/job key (needs a CIX13 method).
5. First sample of a job has CPU 0 (no earlier reading).

## Left
- Wiring in 1 and 2. Draft PR: see below.

CODE DONE (sha in final message)
