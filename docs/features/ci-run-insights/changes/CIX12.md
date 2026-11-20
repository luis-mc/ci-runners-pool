---
change: minor
task: CIX12
---
CI data collector built: job logs and report artifacts are redacted, env values dropped, gzipped into ci-data with caps, a rate budget of a quarter of the hourly limit, retention by days then size per repository, and the Settings keys insights_keep_ci_data, insights_ci_data_days, insights_ci_data_mib_per_repository, insights_test_results_days, insights_resource_samples_days, insights_hold_cap_seconds, insights_guardrail_artifact (R5.2 to R5.6, R6.1, R6.2, R6.5).
