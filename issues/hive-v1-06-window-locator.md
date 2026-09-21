---
id: hive-v1-06
title: WindowLocator — native helper for frontmost CGWindowID and bounds
type: AFK
status: done
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

- [x] Returns a `CGWindowID` and bounds for the frontmost window of the frontmost app.
- [x] Works with Screen Recording permission **not** granted, returning an ID and bounds without a title. **(mandatory)**
- [x] Ignores the app's own overlay and menu-bar windows when determining "frontmost". **(mandatory)**
- [x] Returns a clear "no window" result rather than throwing when the frontmost app has no ordinary window (e.g. Finder with nothing open).
- [x] The returned ID is proven usable by passing it to `screencapture -l` and getting a non-empty image. **(mandatory)**
- [x] Multi-display: bounds are returned in a coordinate space documented and consistent with what `screencapture -R` expects. **(mandatory)**

## Notes

- Implemented as a single Objective-C file compiled by one `clang` invocation
  (`packages/app/native/build.sh`) rather than a node-gyp addon. No build toolchain beyond the
  Command Line Tools, nothing to rebuild per Node version.
- Confirmed empirically: the helper returns the window id and bounds with no Screen Recording
  prompt. Only `kCGWindowName` is gated, and the helper never asks for the title.
- Only layer-0 windows are considered. Menu-bar items, panels and popovers — including our own
  overlay — sit above that, and capturing one instead of the user's window would be silently wrong.
- Every failure is a *result*, never an exception. This sits directly under a hotkey; an
  unhandled throw would be a capture that appears to do nothing.
- The helper also exposes `screen-permission [--request]`, wrapping
  `CGPreflightScreenCaptureAccess` (queries without prompting) and
  `CGRequestScreenCaptureAccess` (raises the dialog). hive-v1-07 needs both.
- **Correction to the research, measured on macOS 26.3:** window and region capture *fail
  loudly* without the grant (exit 1, no file); only full-screen capture succeeds regardless.
  See the correction appended to docs/research/macos-capture-constraints.md.

## Blocked by

- hive-v1-01
