---
change: minor
task: CRSP17
---
R6.4: viewers may read logs and the audit log (owner decision for milestone 1), so listAuditEvents is x-auth user. The live stream is GET /api/v1/events (streamEvents); its LiveEvent schema adds doctor.progress, plan.progress and change.progress. History is served by listJobs and getJob under /api/v1/jobs instead of /api/v1/history.
