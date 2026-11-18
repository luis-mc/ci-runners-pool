---
change: minor
task: OPS25
---
The owner turns real GitHub webhooks on from the console (R5.51): a public https address, a signed self-test, a controller-made secret kept in the OS secret store, and the App's webhook set through `PATCH /app/hook/config`. Turning them off clears the hook and returns to polling. Webhook health counts misses only while they are on.
