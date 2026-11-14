# CRSP19 report: tray menu and auto-update on all OSes

Branch: CRSP19-tray-auto-update. Status: IN PROGRESS.

## Plan
1. Contract: settings.auto_update, GET /api/v1/update, POST /api/v1/update/check, POST /api/v1/update/apply, POST /api/v1/service/restart; regenerate clients.
2. internal/update: release source (GitHub Releases, stable only), SHA256SUMS + attestation verify, drain-gated manager, per-OS apply (MSI helper; tar.gz swap with rollback).
3. Settings default ON (internal/settings).
4. API handlers, controller wiring, CLI `crsp update`, `crsp restart`.
5. Tray menu (new order), update item/header, channel calls.
6. Web: Settings > Updates tab (toggle) and Review step wizard.
7. Docs: tray spec, operations self-update section, change notes.

## Log
- Started.
