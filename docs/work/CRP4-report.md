# CRP4 report: feature spec `machines`

CRP4: machines spec written (62 requirements, R5.1-R5.52 and R6.1-R6.10), all NOT YET IMPLEMENTED, with 13 owner questions open.

Branch: `CRP4-spec-machines`. Status: SPEC DONE.

## Steps

- [x] Branch from `main`, report started.
- [x] Read brief, decisions 0001-0005, stack profile, UX rules v1, agent proto, template, DOCSPEC §4; prior art in dev-standards (`runner-pool/spec.md`, DELIVERYSPEC DL-77/79/90, `load.py`, `load_guard.py`, `delivery_runner_pool.py` DL176/DL177, `test_dl177_pool_measure.py`).
- [x] Wrote `docs/features/machines/spec.md`.
- [x] `docs_index.py build`; `docs_check.py`: only W1 (this report under `docs/work/`, expected; the join strips it).
- [x] Commit and push.

## Notes

- Section 9 test paths are plain text, not code spans, because the files do not exist yet and S2 would fail. When a test lands, wrap its path in backticks.
- Section 12 has `Source:` lines only for files that exist (agent.proto, config.go, main.go). Planned folders are listed without `Source:` (S1).
- The M1/M3 split: the controller-local agent, detection, load, settings, drain, offline/reconnect and the service are M1; join codes, remote machines, removal, maintenance windows and quiet hours are M3; Tart VM limit M5; cache cap enforcement M7.

## Open owner questions

Each has a proposed default in the spec; the owner confirms or changes it.

1. Drain timeout reached: proposed nothing stops and the user chooses wait longer, cancel the change, or stop the named jobs after a yes (R5.33). Or should the change proceed?
2. Default drain timeout: proposed 60 minutes (R5.22).
3. Default job slots per machine: proposed 2, as dev-standards `ci_slots` (R5.22).
4. Allowed backends by default: proposed persistent runner only, others off until turned on (R5.22).
5. Join code lifetime: proposed 15 minutes, ceiling 24 hours (R5.4).
6. Heartbeat 10 s and offline after 30 s (R5.35).
7. Quiet hours meaning: proposed a separate lower budget and slot count during set hours (R5.28). Or "pool-only at night" as the machine being drained by day?
8. Controller certificate rotation: how agents learn a new certificate after the pin (not specified yet; proposal: the controller announces the next fingerprint over the authenticated link before switching).
9. Agent account names per OS: `NT SERVICE\ci-runners-pool-agent`, `crp-agent`, `_crp_agent` (R5.44).
10. Load history retention: proposed 24 hours at 15 s steps (R6.8).
11. Machines per controller target: proposed 50 (R6.9).
12. Removal also wipes images and caches on the machine: proposed yes, listed in the question card (R5.40).
13. Default cache cap: proposed 20 GiB (R5.22).
