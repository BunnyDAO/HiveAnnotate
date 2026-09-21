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

- [ ] Each of the three failure cases shows the bar with a distinct, accurate explanation. **(mandatory)**
- [ ] Text typed before a failure is still present afterwards, in every case. **(mandatory)**
- [ ] Retry after a failure reuses the existing note rather than starting a fresh capture. **(mandatory)**
- [ ] No failure path opens a modal, posts a notification, or changes which app is frontmost. **(mandatory)**
- [ ] With the permission absent, no image file is written anywhere at any point. **(mandatory)**
- [ ] On write failure the bar cannot be dismissed by clicking away — only by a successful write or an explicit discard. **(mandatory)**
- [ ] A capture reported as saved is always actually on disk; there is no path that reports success without a completed write. **(mandatory)**

## Blocked by

- hive-v1-02
- hive-v1-07
- hive-v1-08
- hive-v1-11
