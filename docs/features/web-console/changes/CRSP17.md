---
change: minor
task: CRSP17
---
Section 7 operations land in the M1 contract with these changes: getSession is GET /api/v1/me; repository and runner plans live under /api/v1/repository-plans and /api/v1/runner-plans, with getRepositoryPlan and getRunnerPlan for done-after-reload; planRunnerReplacement replaces a runner not made by CRSP; the M1 owner decisions bring listJobs, getJob, the doctor operations and listAuditEvents (readable by viewers, so R5.13's audit column changes) into milestone 1. getSettings, updateSettings and getQueueSettings, updateQueueSettings are added. streamRunnerLog, exportJobs, images, caches, notifications, updates and config export stay later.
