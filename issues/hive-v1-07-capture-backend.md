---
id: hive-v1-07
title: CaptureBackend — interface + macOS screencapture impl with pre-flight
type: AFK
status: done
blocked_by: [hive-v1-01, hive-v1-06]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The `CaptureBackend` interface plus its macOS implementation. The interface exists from day
one so a Windows port or a future ScreenCaptureKit rewrite is a port and not a rewrite — but
only the macOS backend is built.

Shell out to `/usr/sbin/screencapture`, **not** Electron's `desktopCapturer` (speed and true
Retina resolution). Verified flags:

- window → `-l <windowid>` (from hive-v1-06)
- full screen → `-x`
- region → `-R x,y,w,h`
- plus `-o` (no window shadow), `-r` (strip dpi metadata) as appropriate

`-i` is unusable: it requires a mouse drag.

**Pre-flight the permission with `CGPreflightScreenCaptureAccess` before every capture.**
Without the grant `screencapture` does not fail — it *succeeds* and returns the desktop
wallpaper with every window stripped out. Inspecting the result after the fact cannot reliably
distinguish that from a legitimately empty screen, so the check must come first.

Classify failures explicitly so the UI can respond differently to each: `no-permission`,
`stale-window-id`, `write-failure`.

Captures go straight into app-owned storage. They never touch the Desktop or Preview.

## Acceptance criteria

- [x] Window, full-screen and region captures each produce a valid PNG at full Retina resolution. **(mandatory)**
- [x] Argument construction per target type is asserted against a fake `screencapture` placed on `PATH`. **(mandatory)**
- [x] Permission is checked before invoking; with the grant absent the call returns `no-permission` and **no image is produced**. **(mandatory)**
- [x] A window ID that no longer exists returns `stale-window-id`, not a silent empty image. **(mandatory)**
- [x] A write to an unwritable destination returns `write-failure` with the image still in memory. **(mandatory)**
- [x] No capture is ever written to `~/Desktop`, and no Preview or Mail window is opened.
- [x] The interface is implementation-agnostic: no `screencapture` detail leaks through it. **(mandatory)**

## Notes

- The `screencapture` path is **injected** rather than resolved from `PATH`. The acceptance
  criterion said "a fake on PATH"; injecting the path tests the same thing without mutating the
  environment, which makes the tests safe to run in parallel.
- Verified against the real binary as well as a fake: a 200×100 region comes back at a
  whole-number Retina multiple, a window captures by id, and the frontmost-window id from
  hive-v1-06 is proven to work end to end.
- Nothing is left behind. The bytes are returned in memory and the scratch file is removed;
  a test asserts the Desktop is byte-for-byte unchanged across a capture.
- Exit status 0 with no file on disk is reported as `write-failure`, never as success. Telling
  the user a capture was saved when it was not is the worst available outcome.
- Failure classification is driven by what was actually measured on macOS 26.3, not by the
  original research assumption — see the correction in docs/research/macos-capture-constraints.md.

## Blocked by

- hive-v1-01
- hive-v1-06
