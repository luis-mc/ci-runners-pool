# RES3 / RES7 / RES14 report (branch RES3-console-join-states)

Start checks passed: branch from origin/main at 40f779d, screens + internal/api present.

## Plan
1. RES14: `internal/webhookhealth` tracker (own files); small hook field `OnDelivery` in the webhook handler; poller hook `OnQueued`; API: `webhook_health` on Repository, `POST /api/v1/repositories/{repositoryId}/webhook-mode`; console line + switch back.
2. RES7: Runners screen: state chip idle/busy, running job repository + elapsed, counts line.
3. RES3: join code progress (waiting -> connected -> ready), optional SSH join (Linux/macOS, key used once, never stored), wizard states, copy button.

## Status
- [ ] RES14 backend
- [ ] RES14 console
- [ ] RES7
- [ ] RES3 backend
- [ ] RES3 wizard
- [ ] docs + change notes
- [ ] draft PR

## Notes
- `<luismc-docs>/scripts/docs_fold.py` not found in this sandbox: change notes written by hand as files in `docs/features/<f>/changes/`, same shape as existing notes.
