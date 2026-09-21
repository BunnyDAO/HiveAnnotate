---
id: hive-v1-06
title: WindowLocator — native helper for frontmost CGWindowID and bounds
type: AFK
status: open
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

A small native helper that returns the frontmost window's `CGWindowID` and bounds, so
`screencapture -l <windowid>` has something to aim at.

Implementation: `CGWindowListCopyWindowInfo` cross-referenced with
`NSWorkspace.frontmostApplication`'s PID to find the frontmost *window* of the frontmost
*app*.

**Verified and load-bearing:** this needs **no Screen Recording permission**.
`CGWindowListCopyWindowInfo` returns `kCGWindowNumber` and bounds ungated; only
`kCGWindowName` (the title) is withheld without the grant. So window targeting works before
the user has granted anything — design for that, and do not require the title.

**Do not use the `active-win` npm package.** It is stale (~2 years), and whether its returned
`id` is a literal `CGWindowID` usable by `screencapture -l` was not verified.

## Acceptance criteria

- [ ] Returns a `CGWindowID` and bounds for the frontmost window of the frontmost app.
- [ ] Works with Screen Recording permission **not** granted, returning an ID and bounds without a title. **(mandatory)**
- [ ] Ignores the app's own overlay and menu-bar windows when determining "frontmost". **(mandatory)**
- [ ] Returns a clear "no window" result rather than throwing when the frontmost app has no ordinary window (e.g. Finder with nothing open).
- [ ] The returned ID is proven usable by passing it to `screencapture -l` and getting a non-empty image. **(mandatory)**
- [ ] Multi-display: bounds are returned in a coordinate space documented and consistent with what `screencapture -R` expects. **(mandatory)**

## Blocked by

- hive-v1-01
