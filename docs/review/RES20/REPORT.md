# RES20: crsp image registry, study and review build

A study. No product change merges from this branch. The interactive build is in `app/` (serve with `python3 -m http.server` from `docs/review/RES20`, open `app/`). Screenshots are in `shots/`, listed in `index.html`. It extends the RES19 build (`docs/review/RES19`), which this branch is based on.

Dates: 19 Nov 2026, UTC (the repository has no `.delivery/config.json`, so no owner zone was available).

## 1. What the owner asked

D18, in the owner's words, split into asks:

1. **Pull a ready-made image when one matches, else build locally and push the new image to the registry.** Every image, standard and custom.
2. **The container registry is part of crsp and not public.**
3. **A UX section "Registry" under "Images and caches"** where the owner fully manages the images in the registry:
   - data and metrics on image usage;
   - delete images from the registry;
   - recommendations (for example delete when unused for a while);
   - a maximum disk space for standard images and another for custom images.
4. **Detect updates.** When a run for a repository needs a newer version of a custom image, registry management detects that it is an update of an existing image and offers to replace it, so many versions of similar images that stop being used do not pile up.
5. Analyse, research improvements, define solutions.
6. Also asked: *if a valid image is already in the registry, can Add runners reuse it?* **Yes.** Add runners pulls instead of building (section 4.6).

Binding decisions from RES19 that this study builds on: D15 profiles plus a shared tool cache; D16 covered scan findings apply alone, new layers and every service container need the owner's yes; D17 per-job sidecars, never a Docker socket in a job; D19 the scan runs per queued run's commit on a local shallow copy, custom images keyed by the content of the stack files at that commit; D20 one build per machine at a time, half the cores while jobs run; D21 editable per-cache limits plus a machine budget; D22 software list (Syft) and vulnerability count (Trivy) made by crsp when the registry stores an image, never blocking; D23 the Add runners work step is "Adding runners"; D24 last 5 build logs per machine, 1 MB each.

## 2. Today in crsp

There is **no registry** in crsp. Every machine builds for itself.

| Topic | What exists | Where |
|---|---|---|
| Image name | `crsp-pool:<key>`, a local tag on each machine. No registry host in the name. | `internal/backend/container/images.go` `ImageRepo`, `ImageTag` |
| Key | `sha256(base, layers, pins, extras)[:12]`. Layers sorted. No stack-file content, no arch, no base **digest** in the key. | `internal/runners/images.go` `ImageKey`; `images.go` `KeyFor` |
| Build | `PrepareImage`: if `docker image inspect crsp-pool:<key>` finds it, nothing is built; else **one** `docker build`. No pull, no push. | `images.go` `PrepareImage` (about line 36) |
| Persistent runners | Same image through `persistentImage`; the pool volumes are separate. | `internal/backend/container/persistent.go` `ensurePersistentPool`, `persistentImage` |
| Prune | `PruneImages(keep)` keeps the newest N images per machine and never removes one a labelled container uses (it asks `docker ps -a --filter label=…` and fails closed). Local only. | `images.go` `PruneImages`, `runners.SelectPrune` |
| Shared cache over the LAN | `internal/lancache`: one machine serves a content-addressed cache to the others; every call carries the machine id and credential of the agent link; size cap with LRU; binds one private LAN address, never a wildcard; a client falls back to the normal path when the holder is down. **This is the pattern the registry should follow.** | `internal/lancache/doc.go`, `server.go`, `listen.go` |
| Private registry logins | `regcreds`: logins and a private CA bundle that runners trust; a password reaches the engine only on standard input. | `internal/regcreds` (R5.77, R5.78) |
| TLS | The controller has its own CA and certificate; machines trust it. | `internal/tlsca`, `internal/webui/serve.go` |
| Build status | RES19: always `not_built` today; IMG-1 adds build records and events. | RES19 report section 2 |
| Prebuilt | RES19 section 8 proposed public GHCR for standard images. D18 replaces it with a private registry inside crsp. | – |

So for a repository with four runners on three machines, the same 3 GB image is built three times, once per machine, 15 to 18 min each on amd64 (CRSP184 note). A custom image is never shared.

## 3. Research findings

**Sources reached.** Only GitHub hosts answered (the proxy returned 403 for `distribution.github.io`, `zotregistry.dev` and every other site). Read from `raw.githubusercontent.com` on 19 Nov 2026:

- `opencontainers/distribution-spec` `spec.md` (OCI Distribution Spec): endpoints, delete, referrers.
- `opencontainers/image-spec` `annotations.md`: the standard annotations.
- `distribution/distribution` `docs/content/about/garbage-collection.md` and `recipes/mirror.md`.
- `project-zot/zot` `README.md` (short), `goharbor/harbor` `README.md`, `sigstore/cosign` `README.md`.

Everything else below is from memory and marked **[memory]**. It was not re-checked and the build must confirm it before use.

### 3.1 What the checked sources say

- **Delete is two steps.** The spec has `DELETE /v2/<name>/manifests/<tag-or-digest>` (end-9) and `DELETE /v2/<name>/blobs/<digest>` (end-10); a registry may answer 405 when delete is off. Deleting a manifest makes it unreadable at once; the disk is freed only by garbage collection.
- **Garbage collection in the reference registry (Distribution) is mark and sweep.** Blobs shared by manifests are kept while one manifest refers to them (the guide's example: delete B, layer `c` goes, layer `a` stays). The command is `registry garbage-collect [--dry-run] [--delete-untagged]`. **It is stop-the-world:** the registry must be read-only or stopped, because an upload during GC can have its layers swept and corrupt the image. This drives the design in 6.4.
- **Pull-through cache.** Distribution can run as a mirror with `proxy.remoteurl`; the mirror URL must be the root of a domain. [memory: a registry in proxy mode does not accept pushes, so a mirror and a push registry are two instances.]
- **Referrers.** A manifest can carry a `subject`; the referrers API lists artifacts that refer to a digest (SBOMs, signatures). A registry must accept a manifest whose subject does not exist yet, so push order does not matter.
- **Lineage annotations.** `org.opencontainers.image.base.name` and `.base.digest` name the image this one is built on; `.revision` is the source control revision; `.source` and `.version` too. A "newer version of the same image" has no standard annotation, so crsp adds its own labels (4.3).
- Zot's README: an OCI-only registry, "images stored in OCI image format, distribution specification on the wire, that's it", with a Go module (`zotregistry.dev/zot`). Harbor: CNCF registry with a portal, projects, replication and vulnerability scanning. Cosign: signs and verifies images, signatures stored in the registry.

### 3.2 Comparison (memory unless marked)

| | CNCF Distribution (`registry:2`, v3) | Zot | Harbor | Gitea / Forgejo packages | GHCR |
|---|---|---|---|---|---|
| Embeddable in a Go binary | **Yes**: handlers are a Go package; mount under `/v2/` [memory] | Yes: a Go module [checked: module exists] | No: many services and a database | No | Not self-hosted |
| Size and parts | Small; filesystem storage | Larger; extensions behind build tags [memory] | Heavy (core, jobservice, registry, DB, Redis, Trivy) | Part of the forge | – |
| Garbage collection | Stop-the-world [checked] | Online GC with a delay [memory] | Uses Distribution GC, can run in a window [memory] | Own cleanup rules [memory] | Package retention in the UI [memory] |
| Retention policy | None; deletes by API | Retention (`keepTags`, pulled within, pushed within, most recent N) [memory] | Tag retention rules per project [memory] | Cleanup rules per package [memory] | Manual or Actions [memory] |
| Pull metrics | Notification events (`pull`, `push`, `delete`) [memory] | Metrics endpoint, a search and sync extension [memory] | Pull counts per artifact [memory] | Downloads count [memory] | Download counts [memory] |
| Auth | Basic, token (JWT) or custom [memory] | htpasswd, LDAP, OIDC, token [memory] | Full user and project model | Forge accounts | GitHub accounts |
| Public by default | No | No | No | Follows the forge | Public or private per package |

**Retention in the services crsp should learn from [memory].** ECR lifecycle policies: rules with a priority, matching tag prefix or `imageCountMoreThan` or `sinceImagePushed`, first match wins, expire the rest; a preview before saving. Artifact Registry cleanup policies: delete by age, tag state, version count, with `keep` policies that win over `delete`, and a dry run. GitLab cleanup policies: keep N tags, remove tags older than D days, name regex to keep or remove, and a rule that tags still within an "older than" window are never removed. Harbor tag retention: rules per repository, "most recently pushed N", "pulled within D days", with a dry run and a schedule. What crsp takes: *keep wins over delete*; *a dry run you can read* (our Recommendations list is that); *pulled within D days* as the unused rule; *keep the newest N* as the variant rule.

**Lineage and "replaces".** There is no registry feature for "this image is the newer version of that one". Harbor and the others only show tags in time order. crsp has more than a registry: it knows the profile, the repository and the commit, so the registry can record the lineage itself (section 5). The OCI `base.digest` annotation is kept for the base only.

**Deduplication.** All OCI registries store blobs by digest, so an image that shares layers with another stores them once. The consequence for budgets: an image's "size" is not what deleting it frees. The build shows both (`Size` and `Only this image holds`).

**Pull-through and mirrors.** Useful for upstream bases such as `ubuntu:24.04`, `postgres:16` and `alpine`: a Docker Hub rate limit (100 pulls per 6 h anonymous [memory]) is a real risk for a pool that starts many sidecars. This is RES19 F11 / R5.24; it is a second registry instance in proxy mode and stays out of this task (open question 12).

**Signing.** Cosign (keyed or keyless) and Notation sign by digest and store signatures in the registry (as tags or OCI referrers) [memory]. For a private registry that only crsp writes, a content digest that the controller hands out over TLS already gives integrity; signatures add proof to a third party and tamper evidence on the registry disk. See 8.2.

**Multi-arch.** An OCI image index (manifest list) points to one manifest per platform; `docker pull` picks the platform [memory]. crsp keys include the arch, so every arch is its own image; an index is added only to show "x64 and arm64" as one row of a standard profile.

**Usage metrics.** The registry sees manifest pulls but not which repository a job belonged to. Distribution can send notification events with the actor and user agent [memory]; the agent knows the job. So crsp records usage from **both**: the registry event (who pulled which digest) and an agent report (which key, from where, how long, for which repository). The report is the source for repository and time saved.

## 4. Where it runs, protocol, auth

### 4.1 Options

| | A. Embedded in the controller | B. Bundled container on one machine | C. On every machine, peers pull |
|---|---|---|---|
| Product rule: one Go binary, no terminal steps | **Fits**: a library mounted in the controller | Needs Docker on that machine and a second thing to install, update and watch | Fits, but every machine stores every image |
| Needs Docker on the host | No | Yes (a Windows controller may have none) | Yes, on each |
| Auth | Reuses the machine credential of the agent link, as `lancache` does | A second auth layer to wire | Same as A, times N |
| Metrics and deletion safety | Controller already knows runners, jobs, keys: **one place decides** | Needs an API back to the controller | Needs consensus |
| Disk | The controller's data folder (home pool: usually the always-on PC) | One machine's disk | N times the disk |
| When it is offline | Pulls fail, builds fall back; machines keep their local copies | Same | No single point of failure |
| Effort | M for the mount, L with the rest | M plus packaging | L (replication, GC across nodes) |

**Recommendation: A, embedded in the controller, with Distribution v3 as the library.** Reasons: one binary and no terminal step (the product model); no Docker needed on the controller; the controller is always on in a home pool (it serves the console and the agent link); the controller already decides what may be deleted. HA is not needed (owner). If the controller is down, nothing that runs is hurt: a runner already has its image locally; a machine that needs one pulls nothing and **builds locally as today**, then pushes when the controller is back (a pending push is a visible state). Distribution over Zot because the retention and the recommendations are crsp's own and need the owner's yes, so the registry should be plain storage plus events; Zot's built-in retention would delete without a yes. Revisit Zot if stop-the-world GC proves too disruptive (open question 2).

### 4.2 Storage, disk budget, backup

- **Folder:** `<data_dir>/registry` (`C:\ProgramData\crsp\registry` on Windows, `/var/lib/crsp/registry` on Linux), changeable in the Registry budgets page.
- **Budget:** two limits, **standard images** and **custom images**, each editable (the owner's ask), plus one hard stop: pushes are refused when the disk has less than the existing free floor (the same guard builds use, RES19 I3). Suggested defaults 40 GB and 30 GB (about ten standard images, two arches; the review build uses 30 and 15 to show an over-budget state).
- **What counts:** the sum of the blobs an image holds alone, plus the layers it shares counted **once** against the kind of the oldest image that holds them. The page shows both numbers.
- **Backup:** none for the blobs. The registry is a cache of things any machine can rebuild; losing it costs build time, not data. The **records** (lineage, pulls, pointers, settings) live in the controller store and are covered by the existing backup (`internal/backup`).
- **Disk full:** a push is refused with a plain line; the machine keeps its local image; a Recommendation appears.

### 4.3 Protocol, naming and TLS

- OCI Distribution Spec v1.1 (push, pull, delete, referrers) on the controller's existing HTTPS listener under `/v2/`. Same private LAN address rule as `lancache` (never public, never wildcard). The controller's own CA already signs the certificate; the agent installs the CA for the engine (`/etc/docker/certs.d/<host:port>/ca.crt`, `/etc/containers/certs.d/…` for Podman [memory]) through the `regcreds` CA mechanism. A Docker Desktop host (Windows) needs the same through its settings; the agent does it as a host step.
- **Names:** `crsp/std/<profile>` for standard, `crsp/custom/<owner>-<repo>/<profile>` for custom. Staging area `crsp/_incoming/<machine>/…` (4.4).
- **Tags:** the key, `<stack-hash>-<arch>` (section 5.1). Tags are **immutable**: a key is pushed once; the controller refuses a second push to an existing tag.
- **Labels on every image** (also the OCI annotations): `org.opencontainers.image.revision` (commit), `.source` (repository), `.base.name` and `.base.digest` (the base), and crsp's `io.crsp.profile`, `io.crsp.lineage` (repository + profile + arch), `io.crsp.stack-hash`, `io.crsp.layers`.

### 4.4 Auth: who can push, who can pull, never public

- **Token auth** (the Docker token flow; Distribution supports it [memory]) with the controller as issuer. An agent asks for a token over its agent link (machine id and credential, as for `lancache`); the token is short-lived (10 min) and carries scopes. The engine gets it as a one-time login on standard input (`regcreds` rule, R6.2), or a temporary `DOCKER_CONFIG` folder that is deleted after the pull. **No password is stored on a machine and no job ever sees a registry credential:** the pull is a host step of the agent, not something a runner does.
- **Scopes:** every machine may **pull** `crsp/std/*` and `crsp/custom/*`; a machine may **push only** to `crsp/_incoming/<its own id>/*`.
- **Staging and promotion.** A pushed image is not usable yet. The controller checks it (the digest it was told, the labels, the key it claims, the tag is new), starts the scan (8.1), then **promotes** it: a manifest copy to `crsp/std|custom/…` by digest, no data moves. Only then is it offered to other machines. This stops a compromised machine from poisoning an image that other machines pull (it can push only to its own staging area), and keeps tags immutable.
- **People** do not talk to the registry. The console is the only door (`/api/v1/registry`), with the owner's session. No `docker login` for a person, no anonymous read.

### 4.5 Flow: pull when one matches, else build and push (D18)

```
agent: ensure image K for spec S
  1. local engine has crsp-pool:K ?            -> use it (as today)
  2. controller: "registry has K for this arch, digest D?"   (agent link call)
       yes -> token, pull <host>/crsp/…:K@D, verify digest, tag crsp-pool:K, report "pulled"
  3. else build locally (RES19 IMG-1 streaming build), tag crsp-pool:K, report "built"
       then push to crsp/_incoming/<machine>/…:K, controller promotes it (or refuses)
  any registry failure -> step 3 (build) or keep going; never block a job on the registry
```

Rules: one build per machine at a time and half the cores while jobs run (D20) are unchanged; a push runs after the build and never delays the job that started it. A pull and a push are retried with a back-off and show their state in the build record (`pulled`, `pushing`, `push waits for the controller`).

### 4.6 Can Add runners reuse a valid image from the registry? Yes.

The Add runners wizard asks the controller the same question as the agent ("what does machine M need for these runners, and where is it?") on its **Review** step and shows one line:

| Answer | Review step says | Work step says |
|---|---|---|
| The machine has the image | The job image is ready. | – |
| The registry has key K for this arch | "The registry has key b7e204, signed by crsp. Pull it: 3.4 GB, about 3 min." | "Pulling the job image from the registry on Pi lab, 2.1 of 3.4 GB, about 1 min left" |
| Nothing matches | "Build it here, about 36 min" (RES19) | "Building the job image on Pi lab, step 4 of 6, about 14 min left" |

**Valid** means: the key matches what the runners need now (stack hash, base digest, arch), the digest in the controller record equals the registry's, the image is not deleted or half-promoted. A stale match (an older key of the same lineage) is **not** reused silently; the page offers the newer build and keeps the old image for jobs that run now (RES19 R5.35). The pull time comes from the machine's measured pull speed; with no history the bar is the "unknown total" bar (UX-29). If the pull fails the wizard fails on that step with "Build it here instead" as the next action; the machine is untouched. Screens: `add-runners-pulling-*` (five states, shared Wizard part).

## 5. Image identity and lineage

### 5.1 Key (D19)

`key = sha256(profile id, stack hash, arch, base digest, pins, toolchain set)[:12]`, shown as the first 6 characters in lists.

- **Stack hash** = sha256 over the sorted list of `(path, sha256(content))` of the stack files the scan read **at the run's commit**: manifests, lock files, version files, `Dockerfile`, `compose*.yaml`, `devcontainer.json`, `.crsp.yml`. Line endings are normalised; nothing else. A branch with the same stack files gets the **same key, so the same image** (D19). A branch that changes a lock file gets its own key: a **variant**.
- **Base digest**, not the base name: a security update of `ubuntu:24.04` changes the key and is visible as "base updated".
- Services (sidecars) stay out of the key (RES19 6.2).
- Today's key (`ImageKey`) gains the stack hash, arch and base digest; old keys are read as a different generation and age out (IMG-5).

### 5.2 Pointers: "which image does a repository use now?"

A **pointer** `(repository, profile, arch) -> image` says what the default branch of a repository uses. It moves only when the owner says yes (custom images) or alone for standard images when crsp updates its own pins (RES19 K). A run on a branch looks up its key: if the key equals the pointer's image, it uses it; if the key is in the registry (a variant of another branch), it uses that; else it builds and pushes.

### 5.3 "Is an update of" detection

A newly promoted image **N** is an **update of** image **O** when all hold:

1. same kind (custom), same profile, same arch;
2. **O is the pointer of a repository that N was built for** (the repository whose run needed N);
3. N's stack hash differs from O's and N was built from the **default branch's** commit, or a branch that has merged into it;
4. O still has a pointer to it or was pulled in the last 30 days.

Then N is `update found` and a Recommendation says "Node web apps for docs-site has a newer version" (the build's first card). Signals shown in the compare step: the stack files that differ (path, before, after), the base digest if it differs, and the layers N shares with O.

A **branch** run produces a **variant**, never an update, until it merges. After a merge the default branch's stack files equal the branch's, so the key is the same image: the variant becomes the update **without any new build**. This is the main reason to key by content.

If no pointer exists for N's lineage but another image has the same profile and arch and shares more than 60% of its bytes (layer overlap), crsp shows it as "similar" on the image page, but offers **no** replace; only the pointer rule makes an offer. The overlap number is shown only as information, because a guess must not delete.

### 5.4 Replace flow (needs the owner's yes)

1. **Compare** (wizard step 1): both images, the stack files that differ, what switches, and **Keep the old image for N days** (default 7).
2. **Review**: "Nothing has changed yet." Names old, new, repositories that switch, the date the old one goes and the disk freed.
3. **Replacing**: moves the pointer of each repository, warms machines that held the old image by pulling the new one, marks the old image `superseded` with `keep_until`.
4. **Done**: shows the result and links to the registry.

A job that runs now keeps its image; the next job takes the new one. **Rollback:** a superseded image shows "Go back to this one" until `keep_until`; pressing it moves the pointer back. After `keep_until` crsp deletes it alone (it is already decided and dated). The old image is deleted only when **no pointer** refers to it: if two repositories shared it and only one moved, it stays for the other.

### 5.5 Branch variants (D19) and their cleanup

A variant is deleted alone **7 days after its branch is merged or deleted** (GitHub `pull_request closed` and `delete` events are already received) or **14 days after its last pull**, whichever comes first, if no run is queued for it. The Recommendations list shows the date ahead of time ("crsp on Sat 21 Nov") so nothing disappears unannounced. Whether crsp may do this alone is open question 6.

## 6. Retention and the recommendations engine

### 6.1 Rules

| Rule | Condition | Who decides | Why this way |
|---|---|---|---|
| **Replace** | An update was found (5.3) | **Owner's yes** | Moves what repositories use. |
| **Superseded** | A replaced image past `keep_until` | crsp alone, on the date | Already decided; the owner chose N days. |
| **Variant of a merged or deleted branch** | 7 days after, or 14 days unused | crsp alone, on the date (open question 6) | Rebuilds from the commit if wanted again. |
| **Unused** | No pull for `unused_days` (default 30) and no pointer to it | **Owner's yes** | The owner may still want it. |
| **Over budget** | A kind is over its budget | **Owner's yes**; the list names what to delete first (unused, then the oldest superseded, then variants, then least pulled) | Never deletes in use or pointed-to images. |
| **Dangling layers** | Blobs no manifest refers to | crsp alone, at the weekly cleanup | Not an image; nothing to lose. |
| **Standard image of a profile that was removed** | The profile is gone | **Owner's yes** | Standard images follow profiles. |

*Keep wins over delete* (as in ECR and Artifact Registry): an image with a pointer, one a runner uses, or one inside `keep_until` is never offered for deletion.

### 6.2 What the list shows

One line per recommendation: the sentence, what it frees, who decides (`your yes` or `crsp on <date>`), row action **Open** (UX-72). The first one that waits for the owner is the **one primary** at the foot of the tab (UX-4, UX-73): "Review the newer image", "Review the unused image", "Review the budget". It never has a button that deletes from the list; deleting is on the image page behind a question card (UX-62). A recommendation the owner leaves stays; there is no hidden snooze (open question 10).

### 6.3 Delete safety (server side)

Deleting an image answers **409 `needs_confirmation`** with the running jobs named when a runner uses it (same shape the cache wipe uses), and the question card stays open and lists them. Other checks: the image is a repository's pointer (allowed with a yes, and the card says the next run builds it, about N min); the image is inside its rollback days (allowed, warns). Delete removes the manifest (end-9); blobs wait for GC; machines that hold a local copy keep it until their own prune.

### 6.4 Garbage collection of blobs

Distribution GC is stop-the-world (section 3.1). The controller does it weekly (Sunday 03:00 local) and on a **Clean up now** request:

1. set the registry to read-only (pushes and promotions queue; **pulls keep working**, only writes stop);
2. dry run, then mark and sweep;
3. back to read-write; record bytes freed.

A push that arrives while the registry is read-only waits (a few minutes) or the machine keeps its local image and pushes later. Dangling layers and blobs of deleted manifests are the only things GC removes. If the pause ever hurts, Zot's online GC is the alternative (open question 2).

## 7. Metrics

| Metric | Source | Shown |
|---|---|---|
| Pulls (total, last 7 days, per day for 14 days) | registry `pull` event (manifest GET) with the machine from the token | image page chart; overview "Last 7 days" |
| Last pulled | same | table column; drives `unused` |
| Used by: repositories, profiles, machines | agent report `{key, source, seconds, repository, job}` | image page facts, "Machines that hold it" table |
| Builds avoided | reports with `source = pulled` on a machine with no local copy | overview |
| **Time saved** | the median of earlier local builds of this profile (`typical_seconds`, RES19) minus the pull time, summed | overview and image page |
| Size, unique bytes, shared layers | layer table (digest, size, which images hold it) | image page; budget cards |
| Where it is | agent inventory (which machines hold `crsp-pool:K`) | "Machines that hold it" |
| Vulnerabilities and packages | scan result (8.1) | image page "What is in it" |

Per-pull rows are kept 30 days; daily totals 180 days. Every number has a text form beside the chart (UX-41): the build shows "34 pulls in 14 days, most on 2026-11-15 (8)" and the shared chart's "Show as table".

## 8. Security

### 8.1 SBOM and vulnerabilities (D22)

When an image is promoted, the controller queues a scan work row. A Linux machine that is idle (the pusher first) runs the pinned Syft and Trivy against the **registry reference by digest** (they read layers from the registry, nothing is run), and the result returns to the controller as counts plus the two documents stored as OCI referrers of the image (`subject` = the image digest). It **never blocks** a pull or a promotion; until it is done the page says "not scanned yet". Tool binaries come through `ci_tool.py`-style pinned, sha256-checked downloads (DL-94).

### 8.2 Integrity and signing

- **v1: digest pinning.** The controller records `key -> manifest digest` at promotion and hands that digest to the agent, which pulls `repo@sha256:…` over TLS and refuses a mismatch. This gives integrity with no extra tooling, and mutable tags cannot trick it.
- **Later: cosign signatures** by a key the controller holds in its secret store, stored as referrers; machines verify before use; the page shows "Signed by crsp". It helps an export of the registry and tamper evidence on its disk (open question 11). The build shows `Signed by crsp: yes` as the planned state.

### 8.3 Who can push

Only crsp machines, only to their own staging area, only a new tag, and only through a short-lived token. Promotion is the controller's. No person pushes. The registry never listens on a public address.

### 8.4 Never delete what a runner uses

Section 6.3. In addition GC runs only in its read-only window, and a manifest that a **pending pull** token names is not deleted until the token ends.

## 9. API sketch and data model

Not in `openapi.yaml`; operations the build calls (`apps/web/src/review/mockApi.ts`):

| Operation | Method and path | Notes |
|---|---|---|
| `getRegistry` | `GET /api/v1/registry` | Overview: where it runs, budgets, images, recommendations, 7-day numbers. |
| `listRegistryImages` | `GET /api/v1/registry/images?kind=&state=&repository=&arch=` | Rows for the table (the build reads them from the overview). |
| `getRegistryImage` | `GET /api/v1/registry/images/{id}` | Lineage, shared layers, machines, scan, per-day pulls. |
| `compareRegistryImage` | `GET /api/v1/registry/images/{id}/compare` | The new image against the one it updates: stack file differences, repositories that switch, bytes freed. |
| `replaceRegistryImage` | `POST /api/v1/registry/images/{id}/replace` `{keep_days}` | Moves pointers, starts warming; 202 with a work id. |
| `rollbackRegistryImage` | `POST /api/v1/registry/images/{id}/rollback` | Only while `keep_until` has not passed. |
| `deleteRegistryImage` | `DELETE /api/v1/registry/images/{id}` | **409 `needs_confirmation`** with the running jobs named. |
| `getRegistrySettings` / `setRegistrySettings` | `GET`/`PUT /api/v1/registry/settings` | Budgets, `unused_days`, `keep_old_days`, folder, which cleanups crsp may do alone. |
| `cleanRegistry` | `POST /api/v1/registry/cleanup` | Read-only window, GC, report. |
| Agent link | `POST image-ensure`, `POST image-report`, token endpoint `GET /v2/token` | Not console APIs. |

Data model (controller store):

```
registry_image    id, kind, profile_id, arch, key, stack_hash, base_digest, manifest_digest, size_bytes,
                  state(staged|current|superseded|variant|deleted), branch?, pushed_by, pushed_at,
                  replaces?, replaced_by?, keep_until?, signed, scan_state
registry_layer    digest, size_bytes
registry_image_layer  image_id, layer_digest
registry_pointer  repository, profile_id, arch, image_id, moved_at, moved_by
registry_pull     image_id, machine_id, at, source(pulled|local|built), seconds, saved_seconds, repository?, job?
registry_scan     image_id, packages, critical, high, medium, low, at, sbom_ref, report_ref
registry_settings standard_budget, custom_budget, unused_days, keep_old_days, auto_variants, auto_superseded, folder
registry_event    at, kind(push|promote|delete|replace|rollback|gc), image_id?, who, detail
```

The review build's types are `apps/web/src/screens/images-next/registryModel.ts`.

## 10. UX proposals

Checked: **CORE-1** to **CORE-7**. Design system followed: `v2` (highest numbered folder); words and rule proposed in `next-version` (C1, `content.md` "Registry words", UX-73). Rules used: UX-4, UX-5, UX-13, UX-16, UX-19, UX-25, UX-28, UX-29, UX-30, UX-34, UX-38, UX-41, UX-49, UX-54, UX-58, UX-62, UX-71, UX-72, UX-73.

Shared parts used: `Page`, `PageHeader`, `Tabs`, `Section`, `Card`, `CardGrid`, `Facts`, `Table` (`oneLine`, row action `Open`), `Cut`, `Code`, `Status`, `Tag`, `Progress`, `LevelBar`, `TrendChart`, `Segmented`, `Message`, `ActionBar`, `EditBar`, `NumberField`, `Wizard`, `Breadcrumbs`, `QuestionCard` (through `Ask`). No stylesheet, no `style=`, no new class.

Section shape: tabs **Overview, Profiles, Stacks, Caches, Registry**. The Registry tab's one primary is the first recommendation that waits for the owner.

| Screen | Shots (`shots/<name>-<width>-phosphor-<dark|light>.png`) | What it shows |
|---|---|---|
| Registry tab | `registry-overview` | Standard and custom budget bars (the custom one is over), last 7 days (pulls, builds avoided, time saved), where it runs, recommendations (one line each, who decides), images table (UX-72). |
| Image, newer found | `registry-image-update-found` | State "newer one found", lineage (it replaces), shared layers, pulls by day with text, machines, what is in it, Delete; primary "Review the replacement". |
| Image, in use | `registry-image-in-use` | A runner uses it: Delete opens the question card; Confirm is refused by the server and the card names the job. |
| Image, superseded / unused / variant | `registry-image-superseded`, `registry-image-unused`, `registry-image-variant` | The note for each state and what happens next. |
| Replace wizard | `registry-replace-<phase>` (ten states) | Compare, Review ("Nothing has changed yet."), Replacing, Done, in the shared Wizard part. |
| Budgets | `registry-budgets` | Two budgets, `unused days`, `keep replaced days`, cleanup dates; EditBar counts changes. |
| Add runners, pulling | `add-runners-pulling-<phase>` | "Pulling the job image from the registry on Pi lab, 2.1 of 3.4 GB, about 1 min left". |

**Words** (all listed in `content.md` "Registry words"): states `in use`, `current`, `newer one found`, `superseded`, `unused N days`, `variant of <branch>`; `your yes` and `crsp on <date>`; buttons `Review the newer image`, `Review the replacement`, `Replace the image`, `Edit budgets`, `Delete`.

**What the build shows in the design system.**

1. No new component was needed. `TrendChart` columns carry the pulls with a text line under them and the chart's own table (UX-41).
2. A **refused delete** is a server answer shown in the question card (UX-62); it needs the rule UX-73 sentence so that other deletes behave the same.
3. The state word of a variant is long (`variant of rust-wasm`); fit columns never cut it (UX-72), so the table drops to the card at 393 px as designed. A branch name longer than about 20 characters would need the `Cut` branch form; it is not used on the State column (open design question for the owner, none for the rules).

**Checks run.** `e2e/tests/review/review-layout.spec.ts` now covers the registry screens: the DOM layout judge at 1300 px in dark and light, no sideways scroll at 360, 393 and 1300 px, one-line equal-height rows with the `Open` word only, the ten wizard states of the replace flow and five of Add runners pulling (steps not pressable, Stop only while running, busy primary, Done shows the result, Review says "Nothing has changed yet."), the refused delete, a delete that goes through, the one primary on the Registry tab, the compare step and the budgets edit count. Results are in the PR description. **Human checks that stay:** that the page looks like its siblings; that the words read as a person would say them; that the next action is the obvious one.

## 11. Open questions for the owner

1. **Where does the registry run?** (a) embedded in the controller; (b) a container on one machine; (c) on every machine with peer pull. **Recommend (a).** One binary, no Docker needed on the controller, one place that decides.
2. **Which engine?** (a) Distribution v3 as a library; (b) Zot. **Recommend (a):** plain storage and events; our own engine decides deletes. Cost: GC needs a short read-only window weekly. Choose (b) only if that window is unacceptable.
3. **Who pushes?** (a) staging then promotion by the controller; (b) machines push straight to the final name. **Recommend (a):** a compromised machine cannot poison what others pull.
4. **Standard images.** D18 says build locally and push for every image. (a) First machine builds and pushes; (b) also import ready-made standard images from CI (RES19 E1) so the first machine skips the 15 to 18 min build. **Recommend (a) now, (b) as a follow-up** after IMG-9 CI publishing exists.
5. **Default budgets.** (a) 40 GB standard and 30 GB custom; (b) a share of free disk at setup; (c) ask at setup. **Recommend (a)**, editable, and never above half of the free disk when set.
6. **May crsp delete alone?** The list would be: a superseded image after its rollback days, a variant 7 days after its branch merged or was deleted (or 14 days unused), layers no image uses. (a) yes, with the dates shown ahead; (b) always ask. **Recommend (a).** Everything else (unused, over budget, replace, standard of a removed profile) always asks.
7. **Unused after how long?** (a) 30 days; (b) 60; (c) 14. **Recommend 30**, editable.
8. **Rollback days after a replace.** (a) 7; (b) 3; (c) 14. **Recommend 7**, editable per replace.
9. **When one repository moves and another still uses the old image.** (a) the old image stays for the other (pointer per repository); (b) move both. **Recommend (a).** The page says who still uses it.
10. **Can the owner dismiss a recommendation?** (a) no, it stays until resolved or the rule no longer holds; (b) snooze for 7 days. **Recommend (a)** for v1: fewer hidden states (CORE-3).
11. **Signing.** (a) digest pinning in v1, cosign later; (b) cosign from the start. **Recommend (a).** Integrity is covered; (b) adds a key to manage and a verifier library.
12. **Pull-through mirror of upstream bases** (Docker Hub rate limits for `postgres:16`, `alpine`). (a) later, a second instance in proxy mode (RES19 F11); (b) now. **Recommend (a).**
13. **Controller offline.** (a) machines build locally and push later; (b) the job waits for the controller. **Recommend (a).** A job never waits on the registry.
14. **Where the folder lives on a Windows controller.** (a) the data folder; (b) ask for a folder and a drive at setup. **Recommend (a)** with the folder editable on the budgets page.

## 12. Delivery split

Sizes: S (days), M (1 to 2 weeks), L (more). Real clock-time ETAs come from each brief's `delivery:` block once the tasks are launched; no run times are promised here.

| Task | What | Size | Needs |
|---|---|---|---|
| REG-1 | **Registry core.** Embed Distribution v3 under `/v2/` on the controller listener, filesystem storage in `<data_dir>/registry`, token issuer, scopes, staging and promotion, immutable tags, private-address rule, CA install on the engine host step. | L | – |
| REG-2 | **Ensure image on the agent.** `PrepareImage` becomes local, then pull by digest, then build and push (with the RES19 streaming build); agent report; fallbacks; progress lines for a pull. | M | REG-1, IMG-1 |
| REG-3 | **Keys, pointers and lineage.** Stack hash at the run's commit (D19), base digest and arch in the key, labels, pointer table, "update of" detection. | M | IMG-3, IMG-5 |
| REG-4 | **Records, metrics and read API.** Store tables, pull events and agent reports, layer accounting, `GET /registry` and image reads. | M | REG-1 |
| REG-5 | **Registry UI.** The tab, image page, budgets page, Add runners pulling step (this review build is the start). | M | REG-4, IMG-2 |
| REG-6 | **Retention.** Budgets, recommendations engine, delete with safety, weekly cleanup with the read-only window, `Clean up now`. | M | REG-4 |
| REG-7 | **Replace and rollback.** Compare, wizard, pointer moves, warming, `keep_until`, rollback. | M | REG-3, REG-6 |
| REG-8 | **Scan.** Syft and Trivy work rows, referrers, counts (this is RES19 IMG-10 for the registry). | M | REG-1 |
| REG-9 | **Later.** cosign signatures, mirror instance, ready-made standard seed from CI, a holder other than the controller. | L | REG-1 to REG-7 |

**How it slots into RES19.** IMG-1 (build truth) and IMG-2 (build UI) stay first. **IMG-9 (prebuilt images) is replaced by REG-1 and REG-2**: the registry is private and inside crsp, so its "CI push, pull by key, verify, setting" becomes "push after local build, pull by digest". **IMG-10's SBOM and scan part is REG-8.** IMG-3 (scan, read side) and IMG-5 (profiles) feed REG-3, because the stack hash needs the scan at the commit. REG-4 to REG-7 follow once REG-1 and REG-3 exist. The Registry tab's screens can ship in two steps: first read-only (REG-4, REG-5), then the managing actions (REG-6, REG-7).

## 13. Review build notes

- Built with `pnpm --filter web build:review` into `docs/review/RES20/app/` (relative paths). Open `app/index.html` through `python3 -m http.server` from `docs/review/RES20`; add `?freeze` to the address for a still clock.
- The RES19 screens are all still in the build; the Registry tab is the fifth tab. Real console, real shared parts, fake data. The mock answers only what the screens read; Delete, Replace and budget saves change the fake state for the page view only. Nothing is saved.
- Review-only hooks are the same as in RES19 (`banner`, `activity`, `imagesRoutes` props on `App`); the wizard state picker is review tooling.
- Fake data: eleven images (five standard, six custom; one newer-version pair, one superseded, one unused 41 days, one branch variant), the pulls of 14 days, layers shared between images, five recommendations, a custom budget that is over, and a runner that uses two images (so a delete is refused).
- Research limit: only GitHub hosts were reachable; points marked [memory] are not re-checked.
