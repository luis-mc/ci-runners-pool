# REG14: registry API calls the screens still work around

Agent brief and report. Branch `REG14-registry-api-gaps`. Not part of the pull request for `main`.

## Gaps found

| # | Screen | Workaround | Fix |
|---|---|---|---|
| 1 | Registry tab, State column | `unusedOf` scans the recommendations for `unused` and computes days from `last_pull_at` or `pushed_at` | `unused_days` on `RegistryImageSummary`, set by the server when an open `unused` recommendation names the image |
| 2 | Registry tab, recommendations | `recommendationTitle` joins the list of images (`listRegistryImages`) to name the image of each recommendation | `image` (a summary) on `RegistryRecommendation` |
| 3 | Image page | `inUse` is `machines.some(in_use_by_runner)` | `in_use` on `RegistryImage` |
| 4 | Image page | `sharedBytes = size - unique` | `shared_bytes` on `RegistryImage` |
| 5 | Image page, lineage | `relation` compares the entry with `replaces` and `replaced_by` | `relation` on `RegistryLineageEntry` |
| 6 | Image page, variant note | "7 days" is written in the screen; the setting is `variant_gone_days` | `variant_gone_days` on `RegistryImage` (variants only) |
| 7 | Image page, pulls text | A fallback text is computed when `pulls_text` is missing; the server always sends it | none: the fallback is removed, the field is documented as always present |
| 8 | Replace wizard, Replacing and Done | The list of steps is invented (one line per repository, one "Warm", one "Mark") and matched to `steps_done`, which counts repositories and machines. The two never agreed when a plan had two machines | `steps` on `RegistryReplacePlan`: kind, targets, state, owned by the server |
| 9 | Replace wizard, Review and Done | `until` is computed as now plus the days when the plan has no `keep_until` | a plan that has not ended reports the date it would keep the old image until in `keep_until` |
| 10 | Image page, Go back | The plan is made with `keep_days: 7` written in the screen | `keep_days` is optional on `RegistryReplacePlanInput`; the server uses the setting |
| 11 | Budgets page | Calls `useRegistry` (overview and the whole list of images) only for two counts and two dates | no contract change: reads `getRegistryOverview` alone |
| 12 | Add runners, ready-made line | Maps the machine arch `x64` to `amd64` and takes the first current image of that arch, not the image of the machine's profile | Left: needs the Add runners plan to carry the job image key of the machine (outside the registry API). Spec section 11 |

Items 1 to 10 are additive. Nothing is renamed or removed.
