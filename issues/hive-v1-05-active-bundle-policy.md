---
id: hive-v1-05
title: ActiveBundlePolicy — staleness as a pure, clock-injected function
type: AFK
status: open
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The rule that decides, at the moment of a Capture, whether it appends to the Active Bundle or
opens a new one. A pure function with an injected clock — no I/O, no globals, no `Date.now()`
reached for directly.

Given the Active Bundle (or none), the time of its last Capture, and now: append, or open new.
The Active Bundle goes **stale after 20 minutes** with no Captures. The constant is tunable
and lives in one place.

This is the cheapest thing in the codebase to test exhaustively and the decision most likely
to silently corrupt a Bundle if it is wrong — a mis-filed Capture is not discovered until an
agent reads a Bundle that lies about itself.

## Acceptance criteria

- [ ] No Active Bundle → opens new.
- [ ] Active Bundle with a recent Capture → appends.
- [ ] Active Bundle whose last Capture is older than the threshold → opens new.
- [ ] The exact boundary is specified and tested: a Capture at precisely the threshold resolves deterministically, and the test asserts which side it falls on. **(mandatory)**
- [ ] Full truth table covered by tests with an injected clock; no test depends on wall-clock time or sleeps. **(mandatory)**
- [ ] The threshold is a single named constant, changeable in one edit.
- [ ] A clock that moves backwards (NTP correction, sleep/wake) does not produce a negative age or an unhandled state. **(mandatory)**

## Blocked by

- hive-v1-01
