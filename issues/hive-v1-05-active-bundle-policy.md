---
id: hive-v1-05
title: ActiveBundlePolicy — staleness as a pure, clock-injected function
type: AFK
status: done
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

- [x] No Active Bundle → opens new.
- [x] Active Bundle with a recent Capture → appends.
- [x] Active Bundle whose last Capture is older than the threshold → opens new.
- [x] The exact boundary is specified and tested: a Capture at precisely the threshold resolves deterministically, and the test asserts which side it falls on. **(mandatory)**
- [x] Full truth table covered by tests with an injected clock; no test depends on wall-clock time or sleeps. **(mandatory)**
- [x] The threshold is a single named constant, changeable in one edit.
- [x] A clock that moves backwards (NTP correction, sleep/wake) does not produce a negative age or an unhandled state. **(mandatory)**

## Notes

- The boundary is pinned: at **exactly** the threshold the Bundle is stale. "20 minutes" is
  ambiguous at the instant itself, and an unspecified boundary is where an off-by-one quietly
  mis-files work.
- A non-monotonic clock (NTP correction, sleep/wake) or an invalid timestamp falls through to
  **append**, never to a split. Neither is the user's doing, and scattering their evidence is
  a worse outcome than holding one Bundle open slightly too long.
- The destination carries a `reason`, because the capture bar has to tell the user it opened a
  new Bundle rather than appending. That makes it part of the contract, not a detail.

## Blocked by

- hive-v1-01
