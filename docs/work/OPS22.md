# OPS22: "delivery missed" on luis-mc/comics-organizer

## What the line means (code)
`internal/webhookhealth`: **missed** = the REST poller listed a queued job, and no `workflow_job` webhook announced that job within 2 minutes (`MissedGrace`). It is detected only by crsp itself; it is not a failed GitHub redelivery and not read from GitHub's delivery list. Three failures in a row switch a repository to polling mode. **failed** = a signed delivery arrived but could not be used.
Polling is always on for every repository with the pool on (R5.37, every 15 s), so jobs start even when deliveries miss. There is no relay, smee forwarder or tunnel in crsp.

## Cause candidates, ranked
1. **The GitHub App has no webhook at all (near certain).** `StartAppManifest` (`internal/api/handlers_auth.go`) never sets `ManifestOptions.WebhookURL`; with it empty `BuildManifest` omits `hook_attributes` (R5.5). No code anywhere sets a public webhook URL. So GitHub never calls the controller, every job is first seen by polling, and 2 minutes later each counts as "missed". The v0.1.10 page also said "Jobs are learned by: webhooks" because the console only looked at the polling switch. The LAN address and self-signed TLS change is not the cause: GitHub never tried to reach it. It would also fail if a hook existed: GitHub cannot reach 192.168.1.162 and refuses a self-signed certificate, so a public https address (a tunnel or reverse proxy with a real certificate) is needed.
2. A webhook exists (App edited by hand) but its URL is the old/LAN address, or the certificate is self-signed: GitHub shows red marks in Recent Deliveries. Deliveries never reach crsp, same visible result.
3. Secret mismatch: crsp answers 401 `bad signature`; those are not counted (no `OnDelivery`), the jobs show up as missed.
4. Path: the route is `POST /webhooks/github`. A different path gives 404.

## Confirm on the owner's PC (console only)
- GitHub: open the App (github.com Settings > Developer settings > GitHub Apps > your App > Advanced > Recent Deliveries). Empty list, or the page says "Webhook: Inactive" under General: candidate 1. Red marks with "Connection refused/timed out/certificate": candidate 2.
- crsp console, repository page: the facts now read "Last webhook delivery: no webhook" and "Jobs are learned by: polling" when the App has no webhook (this fix).
- Log lines to paste if it still reads "delivery missed" after the fix: any `webhook` lines in the controller log (Logs screen, search "webhook"): `bad signature`, `webhook secret unavailable`, `unreadable workflow_job`.

## Fix
Done on this branch (a crsp bug, wrong message): with no webhook secret in the store, the tracker records no `missed`; the API says `webhooks_off`; the console shows "no webhook", "Jobs are learned by: polling" and a plain note. A real miss now says what happened and what to check. Tests: `internal/webhookhealth`, `internal/api`, `Repositories.test.tsx`.

Owner setting, only if you want jobs to start at once instead of up to 15 s later: this needs a public https address that forwards to the controller (a tunnel or reverse proxy with a real certificate), then in the GitHub App settings set Webhook URL to `https://<that address>/webhooks/github`, tick Active, set a webhook secret, and subscribe to "Workflow job". The secret must also be stored in crsp; crsp has no console screen for this yet, so this is a follow-up (open question: add a webhook address and secret field to the setup screen). Not needed for jobs to run.
