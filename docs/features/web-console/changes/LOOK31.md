---
change: minor
task: LOOK31
---
The console has six areas: Overview, Shared Pool, Repositories, Jobs, Doctor and Settings. Machines, Runners and Images and caches moved under Shared Pool (`/pool/...`, with Summary and Size and backends) and their old addresses redirect. Add runners asks System, Machine, Number and Labels and no repository; the runner list is grouped by machine with the pool totals; the Overview shows a dismissable "How crsp works" strip on first run; Jobs has By repository, By machine, By runner type, By job type and Wait and duration, and its finished list keeps the last 100 jobs with See all (D24, D29, D31 to D34). `planRunners` takes no scope.
