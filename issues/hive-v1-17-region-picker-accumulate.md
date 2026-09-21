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

- [ ] One letter selects that ninth; the readout and highlight match. **(mandatory)**
- [ ] A second letter extends the selection to the bounding box of both cells, in any order — `Q` then `C` and `C` then `Q` give the same rectangle. **(mandatory)**
- [ ] `Q`+`E` is exactly the top row; `Q`+`C` is exactly the full grid area. **(mandatory)**
- [ ] `␣` descends: the current box becomes the new grid and the marks clear. **(mandatory)**
- [ ] `S ␣ D` produces the same rectangle that `S D` produced under subdivision. **(mandatory)**
- [ ] `⌫` undoes exactly one key, whether that key was a mark or a descend. **(mandatory)**
- [ ] Marked cells are visibly distinct from unmarked ones in the overlay.
- [ ] Cells still tile their grid exactly at every depth, with no cumulative drift. **(mandatory)**
- [ ] `⇧`+arrows still nudge an edge of the resulting box, and a later letter press redefines the box from the marks. **(mandatory)**
- [ ] `⎋` cancels and leaves nothing on disk.

## Manual test checklist

- [ ] `⌥3`, press `Q` then `E`, `⏎` — the capture is the top third of the screen, full width.
- [ ] `⌥3`, press `S`, `␣`, `D`, `⏎` — a small rectangle right of centre.
- [ ] `⌫` steps back through marks and descents in the order they were made.

## Blocked by

- hive-v1-12 (shipped; this changes its interaction model)
