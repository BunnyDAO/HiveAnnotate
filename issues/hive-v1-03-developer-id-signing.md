---
id: hive-v1-03
title: Developer ID signing + notarization wired into the dev loop
type: HITL
status: open
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

**This is a day-one dependency, not a release task.** TCC keys the Screen Recording grant to
the code-signing identity. Unsigned dev builds pin the grant to a per-build cdhash, so the
permission is invalidated on *every rebuild* — a well-documented Electron pain point that
turns the entire development loop into a permissions treadmill.

Set up a stable Developer ID identity, a fixed bundle ID and team ID, and make every local
build sign with it. Add notarization to the release build.

HITL because it needs an Apple Developer account and human credential handling.

## Acceptance criteria

- [ ] Local dev builds are signed with a stable Developer ID and a fixed bundle identifier.
- [ ] Granting Screen Recording once survives at least three consecutive rebuilds without re-prompting. **(mandatory)**
- [ ] The release build is notarized and passes `spctl --assess` / Gatekeeper on a clean machine.
- [ ] Signing configuration is committed; secrets are not.
- [ ] The entitlements set is documented, including why the app is not sandboxed.

## Blocked by

- hive-v1-01
