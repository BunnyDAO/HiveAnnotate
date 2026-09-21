---
id: hive-v1-15
title: Active Bundle survives restart — persist with last-capture timestamp
type: AFK
status: done
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

- [x] Restarting within the staleness window continues the same Active Bundle. **(mandatory)**
- [x] Restarting after the staleness window opens a new Bundle on the next capture. **(mandatory)**
- [x] Staleness is computed from the persisted last-capture time, not from app launch time. **(mandatory)**
- [x] A hard kill (no clean shutdown) does not lose the Active Bundle reference. **(mandatory)**
- [x] A persisted reference to a Bundle that has since been deleted from disk is handled cleanly — next capture opens a new Bundle rather than erroring. **(mandatory)**
- [x] The persisted state is not the source of truth for Bundle contents; BundleStore remains that. **(mandatory)**

## Notes

- Written with write-then-rename, so a hard kill leaves either the old pointer or the new one
  and never a half-written file. A test asserts no temp litter survives.
- An unreadable pointer file degrades **quietly** to "no active bundle" — unlike a damaged
  manifest, which is reported loudly. Losing the pointer costs at worst a new Bundle; losing a
  manifest would mean losing captures.
- The pointer lives beside `bundles/`, not inside it, so nothing listing the bundles directory
  mistakes it for a Bundle.
- A pointer naming a Bundle that has since been deleted resolves to null, so the next capture
  opens a new Bundle instead of failing.

## Blocked by

- hive-v1-04
- hive-v1-05
