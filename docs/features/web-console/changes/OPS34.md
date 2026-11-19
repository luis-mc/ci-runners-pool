---
change: minor
task: OPS34
---
The Jobs section is replaced (section 4.6, R5.104 to R5.118) and built on the real Jobs API: Queue, Running and Done as one row for each workflow run (one row action, *Open run*, that opens the run in place to its jobs) with a Runs | Jobs switch, five groupings from the controller's groups, Charts over 7, 14 or 30 days, a Run page with its job graph and timeline, and a Job page with steps, forecast range and basis, queue place and history; Export CSV on Done and a daily-summaries export on Charts; routes /jobs, /jobs/running, /jobs/done, /jobs/repository, /machine, /runner, /runner-type, /job-type, /charts, /jobs/run/<id>, /jobs/<id>; the old routes redirect (the old Wait and duration tab opens Charts). Rows are one line with one set of row words (UX-72). The numbers R5.101 to R5.103 stay with the Add runners and Repositories rules of the same release.
