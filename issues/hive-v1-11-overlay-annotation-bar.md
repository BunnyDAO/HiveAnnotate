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

- [x] The bar appears with the text field focused and accepting input, with no click. **(mandatory)** — verified end to end by `--self-test`: `focused=INPUT`, then eleven injected keystrokes accumulated into the note.
- [ ] The app being debugged does not lose focus, selection, caret or scroll position while typing. **(mandatory)**
- [ ] On dismiss, focus returns to the app that had it before the hotkey. **(mandatory)**
- [x] Each of the five keys does exactly what is listed above, asserted per key. **(mandatory)** — 14 tests over `CaptureFlow` cover ⏎ / ⇧⏎ / ⇥ / ⌘⏎ / ⎋ without needing a window.
- [x] The first Note of a new Bundle becomes both its Intent and the source of its slug. **(mandatory)**
- [x] When the policy opens a new Bundle due to staleness, the bar says so before the user commits — `destination` carries the reason and the bar renders "the last bundle went quiet, so this starts a new one".
- [x] Filing an empty note is refused **when it would have to name a new Bundle**, and allowed when appending — the image is the evidence and the Bundle already has an Intent. **(mandatory)**
- [x] **Measured: 311–468 ms** from chord to a focused, typeable bar (full-screen capture, four runs). Comfortably inside the two-second design target, and the capture itself dominates it.

## Manual test checklist

The spike proved focus is not stolen at the OS level; whether the *host app* keeps its own
state is only observable by eye.

- [ ] Type a sentence in TextEdit, select two words, press `⌥1`, type, press `⏎`.
      The selection is still highlighted and the caret has not moved.
- [ ] Same over a browser with a focused text field mid-typing.
- [ ] Same over a terminal running something interactive.
- [ ] Press `⌥1` over a **fullscreen** app — the bar appears above it.
- [ ] `⇥` cycles the target bundle and the chip updates.
- [ ] Cmd + Enter saves and puts a one-line pointer on the clipboard (`HiveAnnotate bundle <id>: … Read <path>/bundle.md …`) — paste it into any agent.
- [ ] `⎋` discards: nothing appears in `~/HiveAnnotate/bundles`.
- [ ] After dismissing, focus is back in the app you started from.

## Notes

- Three real bugs were found by `--self-test` that no unit test would have caught, because
  each lived in the seam between processes:
  1. **The preload was emitted as ESM.** The package is `"type": "module"`, so electron-vite
     produced `.mjs`, and Electron only loads an ESM preload with the sandbox off. The bar
     rendered and took keystrokes with no bridge to main at all. Fixed by emitting CJS, which
     keeps the sandbox on.
  2. **The preload imported core's barrel**, dragging `node:fs/promises` into a sandboxed
     context. `appInfo` now has its own export path; it has zero imports by design.
  3. **`send()` raced the renderer's first load.** The window is created lazily on first
     capture, so the opening `capture:pending` was dropped — the bar would have come up blank
     exactly once, which is the hardest kind of bug to reproduce.
- `--self-test` is kept as a smoke test: it fires a capture, types into the bar, presses ⏎ and
  asserts a Bundle landed. Point `HIVEANNOTATE_HOME` at a temp directory before running it.
- The region chord currently falls back to full-screen capture until hive-v1-12 lands.

## Blocked by

- hive-v1-02 (spike must resolve first — every acceptance criterion about focus depends on it)
- hive-v1-04
- hive-v1-05
- hive-v1-07
