---
id: 0005-product-boundary
title: Self-hosted machines first, a tray per OS, no dependency on the delivery plugin
status: accepted
date: 2026-11-13
supersedes:
superseded_by:
type: explanation
---
# Self-hosted machines first, a tray per OS, no dependency on the delivery plugin

## Context and problem

The dev-standards `luismc-delivery` plugin runs a working runner pool on one Windows PC.
This product replaces that pool feature.
The plugin's pool feature is removed once this product is fully working.
The plugin's code and tests hold lessons from real failures.

Users also need an easy way to open the console on each machine, and a clear order of setup.

## Decision

Boundary:

- The product never depends on the delivery plugin at build time or at run time.
- Its logic and tests are ported (machine slots and queue, load measurement, pool plan, doctor, tool cache, CI watching, VM checks), not imported.
- This repository's own CI runs on GitHub-hosted runners, because the repository is public.
  It moves onto the product's own pool once milestone 2 works.
- The product manages self-hosted runners only.
  It does not manage GitHub-hosted runners.

Setup order:

- The user adds machines first.
  A machine is any computer on the user's local network that runs the agent; it does not have to be the controller's machine.
- Runners are created from the web console, per OS, only on machines that support that OS and isolation.
- Cloud machines are a later option.

Local access, one tray per OS:

| OS | Tray | Starts at login | Background service |
|---|---|---|---|
| Windows | Notification-area icon | Per-user startup entry | Windows service |
| macOS | Menu-bar item | LaunchAgent | LaunchDaemon |
| Linux, desktop | StatusNotifierItem (AppIndicator) | XDG autostart entry | systemd unit |
| Linux, headless | None; `crsp open` prints a one-time sign-in link | n/a | systemd unit |

- The tray is a separate process in the user's session, because a service cannot show anything on the desktop.
- It is the `tray` mode of the same binary, built with `fyne.io/systray`.
- **Open** starts the web console signed in through a one-time link.
- Restart and update name the jobs they would stop and ask first.
- Updates install from the tray after the user says yes.

## Consequences

- Each port from the delivery plugin brings its tests with it and cites where it came from.
- The tray's macOS build needs cgo, so macOS release builds run on macOS runners.
- CI starts the built tray and agent binaries, not only unit tests, because a tray that passes its tests can still crash at start.
- Some Linux desktops (stock GNOME) show no tray without an extension.
  The console and `crsp open` work everywhere.
