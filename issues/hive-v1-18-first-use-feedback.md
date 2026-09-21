---
id: hive-v1-18
title: First-use feedback — region on the easy chord, Catalogue chord, full-size viewer
type: AFK
status: done
blocked_by: [hive-v1-14, hive-v1-17]
parent: docs/prd/hiveannotate-v1.md
follows_up: hive-v1-17
---

## What to build

Three changes the user asked for after first real use.

1. **The region picker gets the easiest chord.** It was `⌥3`, but it is the chord the user
   reached for most — windows tend to be maximised, which makes a window capture almost a full
   screenshot, so picking the part you mean is what you actually want. Now
   `⌥1` region · `⌥2` screen · `⌥3` window.
2. **`⌥4` opens the Catalogue**, and pressing it again while the Catalogue is in front puts it
   away. The app has no dock tile, so it takes focus explicitly — otherwise the window would
   open behind whatever the user is working in.
3. **Double-click a screenshot in the Catalogue to view it full size.** `←` `→` step through
   the bundle's captures, `Esc` or a click outside closes it. Enter or Space on a focused
   thumbnail opens it too, so it works without a mouse.

## Acceptance criteria

- [x] Region picker is on `⌥1`; screen `⌥2`; window `⌥3` — asserted against the running app.
- [x] `⌥4` is registered and opens the Catalogue — asserted against the running app.
- [x] Every chord is Option plus a digit, never Option plus a letter: `⌥`-letter produces
      characters people type (ç, œ, ß), and a global chord would swallow them in every app.
- [x] Double-clicking a thumbnail opens the screenshot full size — measured at 908px wide
      against a 176px thumbnail, from the 3600px original.
- [x] Arrow keys step through captures (`1 / 4` → `2 / 4`); `Esc` closes.

## Notes

- The viewer check failed twice before passing, both times because of the test, not the app.
  First it measured on a fixed delay; then it measured the image *after* `Esc` had removed it
  from the page, where every element reads 0px. The app was not changed to make it pass.

## Blocked by

- hive-v1-14, hive-v1-17
