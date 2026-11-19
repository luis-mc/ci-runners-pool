---
title: Address settings
type: guide
---

# Address settings

crsp writes no external address into code. The controller, the agent and the tray read these optional environment variables once at start. A bad value stops the start and the message names the variable. Operations spec: R5.94, R5.96.

| Variable | Default | Use it to |
|---|---|---|
| `CRSP_GITHUB_URL` | `https://github.com` | Point crsp at a GitHub Enterprise Server host |
| `CRSP_GITHUB_API_URL` | `https://api.github.com` (`<CRSP_GITHUB_URL>/api/v3` when only the web address is set) | Name the REST address on its own |
| `CRSP_RUNNER_DOWNLOAD_URL` | `<CRSP_GITHUB_URL>/actions/runner/releases/download` | Fetch the Actions runner archives from a local copy |
| `CRSP_VM_IMAGE_MIRROR` | none | Fetch VM images (`crsp vm`) from a mirror instead of the distro hosts |

Each value is an absolute `https` address (`http` only for `127.0.0.1` and `localhost`), with no trailing slash, query or credentials.

## Mirror the VM images

Set `CRSP_VM_IMAGE_MIRROR=https://mirror.example.com/vm` on the controller and the agent. Every runner's jobs then carry it, and `crsp vm` downloads from there. The mirror holds one folder per distro, named as `crsp vm list` prints it, with the files of the upstream directory: the checksum file and the image.

```
https://mirror.example.com/vm/rocky-9/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2.CHECKSUM
https://mirror.example.com/vm/rocky-9/Rocky-9-GenericCloud-Base.latest.x86_64.qcow2
```

The checksum file is read first and the image is checked against it, so a mirror cannot swap an image. Unset the variable to go back to the distro hosts.
