# CIX15 report: pool sizing from demand, slot advice, job resources

Branch `CIX15-pool-sizing` from `CIX-integration` (6b2697f). Plan row 5 (plan id CIX13).

## Built
- R5.15 `capacity.Demand` (+ `Measure`): load per sorted label set from jobs that went through the slot queue (QueuedAt set). Utilisation = busy slot minutes clipped to the window / (slots x window). Wait = queued to slot (start when no slot time). Service = slot to completion (run + hold). CVs, jobs per hour, p50/p95 (nearest rank), p95 by UTC day. Slots come from a new `SlotSource` interface.
- R5.16 `capacity.AllenCunneen`: Wq formula of the contract on offered load a = rho x c0, new rho = a/c. rho >= 1 gives Saturated, no wait, MinSlots = smallest c with a/c < 0.85. p95 = mean x (observed p95 / model mean now); 3.0 (exponential tail) when no ratio exists.
- R5.17, R5.18 `capacity.Advisor` (insights.Analyser "capacity", kinds pool.size, repo.slots). `SlotRoom` = min(MaxExtraSlots, free memory / slot memory, free CPU / slot CPU), free values already under 85% / 60%. pool.size: p95 > 2 min and +1 slot cuts p95 >= 30%; machine = labels fit, room >= slots needed, most room first; no machine: fix says "Add a machine with at least N GiB free", no action. repo.slots: raise to p95 concurrent (>= 30 min limit wait), capped by memory room; hog (> 50% share, others waited >= 30 min) gets a limit of half the pool slots.
- R5.20 `capacity.Summarise` (known samples only; unknown reason kept) and `store.ResourcesStore` (`Store.Resources()`) implementing `capacity.Resources`; final batch writes the summary from all stored samples (job_ident from jobs table).
- Spec section 9 rows R5.15 to R5.18, R5.20 turned into real paths; change note `changes/CIX15.md`.

## Tests (local, -race -count=2)
- `go test ./internal/insights/capacity/`: 1.0 s total.
- `go test -run TestResourcesStore ./internal/store/`: 3.1 s (mostly the DB open).
- `go vet` of both packages, gofmt clean. Guardrails (tg.py): no break in my files.
- fast_guards: typecheck PASS; secret-scan fails here (gitleaks not installed), lint fails here (golangci-lint built with go1.25 < 1.27.4). Environment, not code.
- docs_check: only the expected W1 for docs/work.

## Contract gaps / questions
1. Nothing in the contract implements `SlotSource`, `HeadroomReader` or `RepoLoadReader` over the store. I built only `Demand` over `insights.JobSource` + `SlotSource`. Headroom and repo load readers (machine load history, wait reason "repository parallel limit" while slots free) have no data source in my files; the join (CIX18 wiring) needs implementations. Question: who writes them? Workaround: interfaces + fakes in tests.
2. `Resources.Add` has no job ident or completion time; I read `job_ident` from `jobs` by raw SQL (no new sqlc query, so no shared generated file changes) and use now as completed_at.
3. repo.slots "within memory headroom": capped only when a slot size is measured on some machine; with none measured the p95 is advised uncapped.

## Left
- Wiring and readers above. No web or API work (not my row).

CODE DONE (sha in the final line of the last report update)
