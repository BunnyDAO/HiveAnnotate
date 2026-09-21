---
id: hive-v1-11
title: Capture overlay — the annotation bar
type: HITL
status: open
blocked_by: [hive-v1-02, hive-v1-04, hive-v1-05, hive-v1-07]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The heart of the product. The bar that appears **in the same beat as the shutter**, with the
text field already focused, so the intent is recorded while it is still in your head.

HITL because this is where the entire premise lives — if it feels slow, or it disturbs the
app being debugged, the product has failed regardless of what the tests say.

Keys:

- `⏎` file it into the Active Bundle
- `⇧⏎` file it and start a new Bundle
- `⇥` switch Bundle
- `⌘⏎` file it and copy the text pointer
- `⎋` discard

The bar shows which Bundle it is filing into, and says so explicitly when
`ActiveBundlePolicy` has opened a new one because the previous went stale.

**The first Capture's Note seeds both the Bundle's Intent and its name.** The user is never
prompted for an Intent — a one-Capture Bundle costs exactly one sentence, total.

Reference design: the "Capture moment" artboard on the design canvas.

## Acceptance criteria

- [ ] The bar appears with the text field focused and accepting input, with no click. **(mandatory)**
- [ ] The app being debugged does not lose focus, selection, caret or scroll position while typing. **(mandatory)**
- [ ] On dismiss, focus returns to the app that had it before the hotkey. **(mandatory)**
- [ ] Each of the five keys does exactly what is listed above, asserted per key. **(mandatory)**
- [ ] The first Note of a new Bundle becomes both its Intent and the source of its slug. **(mandatory)**
- [ ] When the policy opens a new Bundle due to staleness, the bar says so before the user commits.
- [ ] Filing an empty note is either prevented or produces a Bundle that is still valid and nameable. **(mandatory)**
- [ ] Hotkey → bar visible is fast enough to type into immediately; measure it and record the number.

## Blocked by

- hive-v1-02 (spike must resolve first — every acceptance criterion about focus depends on it)
- hive-v1-04
- hive-v1-05
- hive-v1-07
