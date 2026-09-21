---
id: hive-v1-15
title: Active Bundle survives restart — persist with last-capture timestamp
type: AFK
status: open
blocked_by: [hive-v1-04, hive-v1-05]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

Resolves an open question the PRD flagged rather than assumed: what happens to the Active
Bundle across an app restart, a reboot, or a crash.

Persist the Active Bundle reference together with its **last-capture timestamp**, so the
staleness rule survives a restart and keeps meaning the same thing. Restarting the app two
minutes after a capture should continue the same Bundle; restarting the next morning should
not.

The alternative — dropping the Active Bundle on every launch — is wrong: it would silently
split one problem into two Bundles for anyone who restarts the app mid-debug, which is exactly
the failure the staleness rule exists to prevent.

## Acceptance criteria

- [ ] Restarting within the staleness window continues the same Active Bundle. **(mandatory)**
- [ ] Restarting after the staleness window opens a new Bundle on the next capture. **(mandatory)**
- [ ] Staleness is computed from the persisted last-capture time, not from app launch time. **(mandatory)**
- [ ] A hard kill (no clean shutdown) does not lose the Active Bundle reference. **(mandatory)**
- [ ] A persisted reference to a Bundle that has since been deleted from disk is handled cleanly — next capture opens a new Bundle rather than erroring. **(mandatory)**
- [ ] The persisted state is not the source of truth for Bundle contents; BundleStore remains that. **(mandatory)**

## Blocked by

- hive-v1-04
- hive-v1-05
