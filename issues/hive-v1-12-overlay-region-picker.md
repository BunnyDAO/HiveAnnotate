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

- [ ] Two keystrokes plus `⏎` produce a capture of the expected rectangle, asserted against exact pixel coordinates. **(mandatory)**
- [ ] Subdivision is correct at every level, including the third and fourth, with no cumulative rounding drift. **(mandatory)**
- [ ] `⌫`, `␣`, `⇧`+arrows and `⎋` each behave as listed, asserted per key. **(mandatory)**
- [ ] Works across multiple displays and on a non-primary display, with coordinates matching what `-R` expects. **(mandatory)**
- [ ] Works over a fullscreen app.
- [ ] On capture, the annotation bar opens directly — the user never returns to the desktop in between. **(mandatory)**
- [ ] Cancelling returns focus to the prior app and leaves nothing on disk. **(mandatory)**

## Blocked by

- hive-v1-02
- hive-v1-07
