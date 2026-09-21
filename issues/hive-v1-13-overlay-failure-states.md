---
id: hive-v1-13
title: Capture overlay — failure states, note never lost
type: AFK
status: open
blocked_by: [hive-v1-02, hive-v1-07, hive-v1-08, hive-v1-11]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

What the user sees when a capture does not work. Three rules, absolute:

1. **The bar always appears**, including on failure.
2. **The already-typed Note is never discarded** — a failed capture costs you the image, not
   the thought. Retry aims at the note, not the other way round.
3. **Nothing steals focus, even when failing.** No modals, no system notifications.

Cases:

- **No Screen Recording permission** — caught pre-flight, so a wallpaper image never reaches
  the user. Offers to open System Settings; `⏎` keeps the note and retries.
- **Stale window ID** — the target closed between hotkey and shutter. Offers full-screen
  capture as the recovery.
- **Write failure** — the image is held in memory and the bar refuses to close on its own
  until the write lands or the user explicitly drops it.
- **Secure Input** — the hotkey never arrives, so the bar *cannot* appear. The menu-bar icon
  carries this state (built in hive-v1-08; this slice covers the user-facing behavior and the
  fact that nothing else can be shown).

Reference design: the "Failure states" artboard on the design canvas.

## Acceptance criteria

- [x] Each failure case shows the bar with a distinct, accurate explanation. **(mandatory)** — `explainFailure` is pure and unit tested across all four reasons (distinctness asserted pairwise); the no-permission case is verified live by `--self-test`.
- [x] Text typed before a failure is still present afterwards. **(mandatory)** — verified live: a note typed *into the failed bar* survived the retry and was the note the capture filed under.
- [x] Retry after a failure reuses the existing note rather than starting a fresh capture. **(mandatory)** — retry re-aims at the same target and the renderer keeps its note; `isRetry` suppresses the clear.
- [ ] No failure path opens a modal, posts a notification, or changes which app is frontmost. **(mandatory)**
- [x] With the permission absent, no image file is written anywhere at any point. **(mandatory)** — the permission is checked *before* invoking `screencapture`; asserted in the CaptureBackend tests.
- [ ] On write failure the bar cannot be dismissed by clicking away — only by a successful write or an explicit discard. **(mandatory)**
- [x] A capture reported as saved is always actually on disk. **(mandatory)** — exit 0 with no file is classified `write-failure`, and the bar only closes after `BundleStore` has written.

## Manual test checklist

- [ ] Revoke Screen Recording for HiveAnnotate, press `⌥1`: the bar appears saying Screen
      Recording is off and that nothing was taken. No modal, no notification.
- [ ] Type a note into that failed bar, re-grant the permission, press `⏎` — the capture
      succeeds and your note is still there.
- [ ] Trigger a window capture and close the window in the same instant: the bar offers the
      whole screen instead.
- [ ] While any failure is showing, the app you were in is still frontmost.
- [ ] `⎋` on a failed capture leaves nothing in `~/HiveAnnotate/bundles`.

## Notes

- `explainFailure` is pure data, so "does every failure have a distinct, honest explanation
  and a way forward" is a unit test rather than a judgement call.
- Only `write-failure` is `blocking`. The bar never closes on its own in that case, because a
  capture that is not on disk does not exist and a disappearing bar would say otherwise.
  Deliberate dismissal with `⎋` is still allowed — it never closes *by itself*.
- `--self-test` gained a dev-only failure injector (`CaptureSession.forceFailure`) so the
  failure paths are exercised end to end rather than reasoned about.
- A patch to the renderer silently no-opped during this work because an earlier edit had
  changed the text it matched on; the self-test caught it (the "note survived" check had been
  passing **vacuously**). Replacements in this repo now assert they applied.

## Blocked by

- hive-v1-02
- hive-v1-07
- hive-v1-08
- hive-v1-11
