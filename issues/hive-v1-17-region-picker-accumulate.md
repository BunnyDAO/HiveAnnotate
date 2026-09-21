---
id: hive-v1-17
title: Region picker selects by accumulation, not only subdivision
type: AFK
status: open
blocked_by: [hive-v1-12]
parent: docs/prd/hiveannotate-v1.md
follows_up: hive-v1-12
---

## What to build

Change the region picker from *subdivide-only* to **accumulate, then descend**.

Today each grid key drills into a ninth. That reaches small rectangles quickly but reaches
*wide* ones badly — a sidebar, a top bar, the left two-thirds are not a single ninth of
anything, and getting them means nudging an edge dozens of times.

The new model: **the letters you press mark cells, and the selection is the bounding box of
everything marked.** The first press anchors, each later press extends. That makes it a
corner-to-corner drag done with the keyboard:

- `Q` then `C` — the whole screen
- `Q` then `E` — the top row
- `S` then `X` — the middle column, lower two-thirds

Precision is preserved by making descent explicit:

| Key | Action |
|---|---|
| letters (`QWE/ASD/ZXC`) | first press anchors; each later press extends the box to include that cell |
| `␣` | **descend** — the current box becomes the new grid, so letters now subdivide it |
| `⏎` | capture |
| `⌫` | undo the last key |
| `⇧`+arrows | nudge an edge |
| `⎋` | cancel |

`S ␣ D ⏎` reaches the same small rectangle that `S D ⏎` reaches today — one extra keystroke
for deep precision, in exchange for reaching wide shapes at all.

This replaces `␣`'s current "grow in place" meaning, which existed only to differentiate it
from `⌫` and becomes redundant once another letter can extend the selection.

## Acceptance criteria

- [x] One letter selects that ninth; the readout and highlight match. **(mandatory)**
- [x] A second letter extends the selection to the bounding box of both cells, in any order — `Q` then `C` and `C` then `Q` give the same rectangle. **(mandatory)**
- [x] `Q`+`E` is exactly the top row; `Q`+`C` is exactly the full grid area. **(mandatory)**
- [x] `␣` descends: the current box becomes the new grid and the marks clear. **(mandatory)**
- [x] `S ␣ D` produces the same rectangle that `S D` produced under subdivision. **(mandatory)**
- [x] `⌫` undoes exactly one key, whether that key was a mark or a descend. **(mandatory)**
- [x] Marked cells are visibly distinct from unmarked ones in the overlay.
- [x] Cells still tile their grid exactly at every depth, with no cumulative drift. **(mandatory)**
- [x] `⇧`+arrows still nudge an edge of the resulting box, and a later letter press redefines the box from the marks. **(mandatory)**
- [x] `⎋` cancels and leaves nothing on disk.

## Manual test checklist

- [ ] `⌥3`, press `Q` then `E`, `⏎` — the capture is the top third of the screen, full width.
- [ ] `⌥3`, press `S`, `␣`, `D`, `⏎` — a small rectangle right of centre.
- [x] While picking, the area inside the frame is at full brightness and readable; only the outside is dimmed. **Measured by `--leak-test`: 1.19% off-colour inside the selection (the grid letter), 100% dimmed outside.**
- [x] No dim wash, grid lines or letters are baked into the image. **Measured by `--leak-test`: 0.00% off-colour in the real capture, against a 49.31% positive control with the picker on screen.**
- [ ] `⌫` steps back through marks and descents in the order they were made.

## Notes

- Verified end to end: `Q` then `E` captured **3600×780 of a 3600×2338 screen** — full width,
  exactly a third of the height, a shape subdivision could not reach. `S ␣ D` still captures
  the same 400×258 rectangle that `S D` did under hive-v1-12.
- **Spotlight overlay** (raised by the user while this was being built): the selection is a
  clear hole showing the real screen at full brightness; only the outside is dimmed, at 42%
  rather than 55%. Grid cells are outlines and letters only — nothing is painted inside the
  frame, because anything painted there stands between the user and what they are framing.
- **Real race fixed.** `hide()` was a request, not a guarantee, so a capture could fire while
  the picker was still on screen and bake the overlay into the screenshot. Hide now resolves
  on the window's `hide` event plus one composited frame, and the capture awaits it.
  The self-test had been failing for exactly this reason: the picker was still the visible
  window when the bar came up, so the test typed the note *into the picker*. A key-by-key
  trace of both windows made that unambiguous.

### A regression caught by the positive control

The first leak-test run reported the overlay as **100%** off-colour with only `Q` marked — too
strong, because most of the rectangle should have shown the backdrop through the spotlight.
Cause: fixing the Catalogue had given the page `<body>` an opaque background, and every surface
loads the same page. **The "transparent" picker had become a solid sheet over the screen** —
the exact opposite of what the user had just asked for. Captures stayed clean (the picker hides
first), which is why nothing else noticed. Body is transparent again; surfaces that want a
background set it on their own root.

The test is deliberately deterministic: it paints a solid-colour backdrop it controls, so the
result cannot depend on what else is on the user's screen. An earlier version counted
honey-coloured pixels on the live display and could not tell the overlay's orange from orange
that was genuinely there — it was discarded rather than trusted.

## Blocked by

- hive-v1-12 (shipped; this changes its interaction model)
