---
change: patch
task: OPS22
---
No CLI behaviour changes. The controller wiring only tells the webhook health tracker whether the GitHub App has a webhook, so a repository of an App without one is no longer reported as a missed delivery.
