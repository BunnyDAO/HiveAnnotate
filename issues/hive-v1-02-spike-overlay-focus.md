---
id: hive-v1-02
title: "SPIKE: overlay receives keystrokes without stealing focus"
type: HITL
status: open
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

**Not a feature — a decision backed by evidence.** Every UI slice is blocked on this.

The capture overlay must receive keyboard input *without* stealing focus from the app being
debugged. On macOS these are normally mutually exclusive: the standard non-stealing overlay
is an `NSPanel` that refuses `canBecomeKeyWindow`, and a window that cannot become key cannot
receive keystrokes.

Electron PR #40307 (Electron 28+, Sonoma+) suppresses `activateIgnoringOtherApps` when
`.focus()` is called on a `type: 'panel'` window, which is the one known mechanism that
threads this. Cross-version reliability and focus-RETURN behavior are **unverified**.
Focus-return will likely require capturing the previously-frontmost app's PID and calling
`NSRunningApplication.activate()` explicitly rather than relying on the OS.

Build the smallest throwaway harness that answers the question, on the actual target macOS
version. Do not build product UI here.

## Acceptance criteria

- [ ] A transparent, always-on-top panel window appears over a fullscreen app on a hotkey.
- [ ] It receives typed characters with no click first.
- [ ] The previously-focused app does **not** visibly deactivate, and does not lose its text selection, caret position or scroll state.
- [ ] On dismiss, focus returns to the exact app and window that had it before, verified across at least three host apps including a browser and a terminal. **(mandatory)**
- [ ] Behavior is recorded for the current macOS version and one prior major version.
- [ ] A written verdict lands in the issue: which mechanism works, what is required for focus-return, and any conditions under which it fails.

## If the spike fails

Record which rung is taken and why:

- **(a)** Accept a brief focus handover and restore the prior app explicitly on dismiss.
- **(b)** Write the overlay as a small native Swift helper; keep Electron for the Catalogue.
- **(c)** Fall back to annotating in a normal window. This **degrades the core premise** and
  must trigger a loop-back to DESIGN (`valk-revisit design`) rather than being absorbed
  silently into the build.

## Blocked by

- hive-v1-01
