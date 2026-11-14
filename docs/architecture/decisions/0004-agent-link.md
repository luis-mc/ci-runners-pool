---
id: 0004-agent-link
title: Agents connect outbound to the controller over gRPC with a per-machine key
status: accepted
date: 2026-11-13
supersedes:
superseded_by:
type: explanation
---
# Agents connect outbound to the controller over gRPC with a per-machine key

## Context and problem

Every machine in the pool runs an agent.
The controller sends it commands (start runner, drain, update) and the agent sends back load, capacity and logs.
Machines sit on the user's local network, often behind their own firewalls.
Opening an inbound port on each machine is a security cost and an install cost.

## Options considered

1. **gRPC bidirectional stream (connect-go), outbound from the agent.**
   Pros: a typed `.proto` contract; streaming both ways on one connection; generated code.
   Cons: harder to pass through some HTTP proxies than plain WebSocket.
2. **WebSocket with JSON messages.**
   Pros: passes through most proxies.
   Cons: the message schema has to be kept and checked by hand.
3. **The controller calls each agent.**
   Cons: needs an inbound port on every machine.

## Decision

Option 1.
The contract is `packages/contract/proto/agent/v1/agent.proto`.
The agent opens a TLS connection to the controller and keeps one bidirectional session open.
No inbound port opens on the machine.

Joining:

- The console shows one install command with a one-time join code.
- At join, the controller issues a key for that machine.
  The agent keeps it in the OS secret store.
- Every later connection proves that key.
  Removing a machine revokes its key.

## Consequences

- The controller needs a TLS certificate the agents trust.
  On a local network that is a certificate the controller makes, pinned by the agent at join.
- Agents reconnect with backoff; the controller treats a silent agent as offline after a timeout.
- Queue slots held by an agent that went away are found and freed (see the scheduling spec).
- Later, the same link serves machines outside the local network, such as cloud machines.
