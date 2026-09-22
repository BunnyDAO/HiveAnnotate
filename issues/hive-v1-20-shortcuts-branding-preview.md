---
id: hive-v1-20
title: Platform shortcuts, HiveOp branding, and preview before saving
type: AFK
status: open
blocked_by: [hive-v1-19]
parent: docs/prd/hiveannotate-v1.md
follows_up: hive-v1-19
---

## What to build

1. **Shortcuts follow the platform.** `CommandOrControl + Shift + digit` — Cmd on a Mac, Ctrl on
   Windows. Region `1` (Enter right away for the whole screen), window `2`, Catalogue `0`.
   Plain Cmd + digit is avoided (tab switching in iTerm2, Chrome, Safari, Slack); 3–6 are
   macOS's own screenshot shortcuts. Every label is in the platform's words.
2. **HiveOp branding.** A mark derived from HiveOp's hexagon with a capture frame inside, in
   HiveOp's gradient: app icon, menu-bar template (a simplified 16px variant), About window and
   a Catalogue footer. "Made by HiveOp" in the tray. Links open in the browser, hiveop.io only.
3. **Preview before saving.** A thumbnail in the bar; Cmd/Ctrl + P shows the capture large with
   the note still focused; Esc closes the preview without discarding the capture.

## Acceptance criteria

- [x] Chords register as Cmd/Ctrl + Shift + 1 / 2 / 0 — verified in the running app.
- [x] The tray reads them in the platform's words, never "Alt" or a glyph.
- [x] Cmd + P grows the bar to a large preview (900 → 1548px) showing the full capture.
- [x] Esc closes the preview and keeps the capture; previewing never saves anything.
- [x] About shows the mark, "by HiveOp", and "Your screenshots never leave your Mac."
- [x] Only https://hiveop.io links can open, asserted by unit test.
- [ ] The bar at its new 1000px width fits all six hints on one row — **not yet re-photographed**.
- [ ] Cmd + P works with focus elsewhere in the bar (after clicking the thumbnail) — **covered
      by code, not yet exercised on screen**.

## Notes

- Also fixed while verifying: a new capture that failed at once inherited the previous
  capture's note (the bar window is reused); the picker's zoom depth counted selections; and
  the self-test's "whatever window is visible" lookups, which flaked four times, now wait for
  a named surface and close any leftover before the next capture.
- Some flakiness during this round came from the user typing while the on-screen test ran —
  visible in one screenshot. On-screen runs should not overlap real use.

## Blocked by

- hive-v1-19
