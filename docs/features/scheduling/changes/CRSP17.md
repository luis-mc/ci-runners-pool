---
change: minor
task: CRSP17
---
Gate traffic is multiplexed on the one agent Session stream (agent.proto GateRequest, GateBeat, GateCancel, GateDecision, JobCompleted, HolderReport) instead of one stream per waiting hook; GateCancel removes the ticket at once when the hook goes away, and the beat limit stays the backstop. Slot tokens are named claims. The machine_sched table is merged into machine_settings; queue order is a setting (getQueueSettings, updateQueueSettings) per the owner decision for milestone 1.
