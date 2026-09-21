---
id: hive-v1-12
title: Capture overlay — keyboard region picker
type: AFK
status: open
blocked_by: [hive-v1-02, hive-v1-07]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

Mouse-free selection of an arbitrary rectangle. **Co-primary with focused-window capture**,
not a fallback — the locked intent is "any part of the desktop", so this gets full polish and
equal test weight.

A transparent overlay divides the screen into a 3×3 grid labelled `QWE` / `ASD` / `ZXC`.
Pressing a key subdivides that cell into another 3×3. Two keys reach a small rectangle; keep
going to refine.

- `⏎` capture the current rectangle
- `⌫` back one level
- `␣` grow back one level
- `⇧` + arrows nudge an edge
- `⎋` cancel

Resolves to `screencapture -R x,y,w,h`. On capture, the annotation bar opens in the same
sequence — the region picker is a prefix to the capture flow, never a separate mode that ends
on its own.

Reference design: the "Keyboard region picker" artboard on the design canvas.

## Acceptance criteria

- [x] Two keystrokes plus `⏎` produce a capture of the expected rectangle, asserted against exact pixel coordinates. **(mandatory)** — `s` then `d` selects `1000,520 200×129`; the self-test captured it at `400×258`, exactly 2× on Retina.
- [x] Subdivision is correct at every level, including the third and fourth, with no cumulative rounding drift. **(mandatory)** — cell edges are derived from the parent each time, and a test asserts the nine cells tile the parent exactly at depths 1–4.
- [x] `⌫`, `␣`, `⇧`+arrows and `⎋` each behave as listed, asserted per key. **(mandatory)**
- [x] Geometry is verified on a display with a non-zero origin (a secondary display sits at an offset in the global space `-R` uses). The picker opens on the display under the cursor. Actually exercising a second physical display is in the manual checklist. **(mandatory)**
- [ ] Works over a fullscreen app.
- [x] On capture, the annotation bar opens directly — verified by the self-test, 176 ms from `⏎` to a focused bar. **(mandatory)**
- [ ] Cancelling returns focus to the prior app and leaves nothing on disk. **(mandatory)**

## Manual test checklist

- [ ] `⌥3` dims the screen and draws the 3×3 grid with QWE/ASD/ZXC.
- [ ] Two keys narrow the selection and the readout shows the rectangle.
- [ ] `⌫` steps back one level; `␣` grows the selection in place.
- [ ] `⇧`+arrows nudge an edge.
- [ ] `⏎` captures and the annotation bar opens immediately.
- [ ] `⎋` cancels and leaves nothing in `~/HiveAnnotate/bundles`.
- [ ] The picker appears over a **fullscreen** app.
- [ ] On a **second physical display**, the picker opens on the display the cursor is on and
      the captured rectangle matches what was highlighted.

## Notes

- `⌫` and `␣` are deliberately different. `⌫` undoes a subdivision and jumps back to a
  rectangle nine times the size; `␣` keeps the selection where it is and enlarges it by one
  cell on each side. One is navigation, the other is fine adjustment.
- Cell edges are computed from the parent rectangle on every subdivision rather than by
  repeatedly flooring a cell size. Flooring drifts several pixels by the fourth level, and the
  selection stops matching what is drawn.
- `regionSelection.ts` has zero imports, so the renderer owns the geometry directly through its
  own export path — the same trick as `appInfo`, and for the same reason: core's barrel drags
  in `node:fs`.
- Found and fixed while verifying this: bundle ids used the **UTC** date, so a capture at 9pm
  local was filed under tomorrow. Now local date.

## Blocked by

- hive-v1-02
- hive-v1-07
