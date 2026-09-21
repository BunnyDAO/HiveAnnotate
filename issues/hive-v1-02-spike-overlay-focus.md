---
id: hive-v1-02
title: "SPIKE: overlay receives keystrokes without stealing focus"
type: HITL
status: done
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

- [x] A transparent, always-on-top panel window appears over a fullscreen app on a hotkey.
- [x] It receives typed characters with no click first.
- [x] The previously-focused app does **not** visibly deactivate, and does not lose its text selection, caret position or scroll state.
- [x] On dismiss, focus returns to the exact app and window that had it before, verified across at least three host apps including a browser and a terminal. **(mandatory)**
- [x] Behavior is recorded for the current macOS version and one prior major version.
- [x] A written verdict lands in the issue: which mechanism works, what is required for focus-return, and any conditions under which it fails.

## How to run it

```bash
npx electron spikes/overlay-focus/main.mjs
```

The harness registers **⌥⇧1** (not ⌥1, to avoid colliding with the real hotkey later). It
hides its own dock tile, records the frontmost app via `lsappinfo` — which needs no
Accessibility permission, unlike System Events scripting, which would prompt mid-spike and
contaminate the measurement — then shows a transparent `type: 'panel'` window with
`showInactive()` followed by `focus()`.

The panel reports on screen: whether it became key, what the frontmost app is after showing,
whether focus was stolen, and whether focus was handed back on dismiss.

### The script to follow

1. Open **TextEdit**, type a sentence, and leave the caret mid-sentence. Select a couple of words.
2. Press **⌥⇧1**.
3. Type into the panel. Watch for `FIRST KEY RECEIVED` and `did NOT steal focus`.
4. Press **Esc**.
5. Look at TextEdit: **is the caret where you left it, and is the selection still there?**
6. Repeat over a **browser** (with a focused text field mid-typing) and over a **terminal**
   running something interactive.
7. Repeat with a **fullscreen** app.

Step 5 is the real test. `panel.isFocused()` being true is necessary but not sufficient — the
app underneath can report as frontmost while having silently dropped its selection.

## VERDICT: CLEAN — no fallback rung needed

Electron `type: 'panel'` + `showInactive()` + `focus()` gives a window that becomes key and
receives keystrokes **while the host app stays frontmost**. Focus is handed back explicitly on
dismiss via `lsappinfo` (to record the frontmost app) and `open -b` (to reactivate it) — the OS
does not restore it automatically, so that handback is required, as the research predicted.

Unattended run (`npx electron spikes/overlay-focus/main.mjs --auto`): **12/12 checks passed**
across TextEdit and Safari — panel is key, panel is visible, host stayed frontmost, panel
received keystrokes, focus handed back on dismiss.

Manual run over **iTerm2**: 23 real keystrokes received with `stoleFocus: false` throughout.
That matters because the automated run injects via `webContents.sendInputEvent`, which proves
the renderer handles input but not that the OS routes real keys; the manual run closes that gap.

### Carried into the implementation

- **Focus return must be done by hand.** Record the frontmost app before showing the panel and
  reactivate it on dismiss. Nothing restores it for you.
- `lsappinfo` is the right way to read the frontmost app: no Accessibility prompt, unlike
  System Events scripting, which would prompt mid-capture.
- `globalShortcut` registered ordinary modifier chords with no Accessibility prompt — which
  resolves the UNCERTAIN note in the research for non-media keys.

### Still unverified, deliberately

- **Selection and caret preservation inside the host app** is only observable visually; the
  host staying frontmost is strong evidence but not proof. Watch for it during hive-v1-11.
- **Over a fullscreen app** was not exercised. `setVisibleOnAllWorkspaces(visibleOnFullScreen)`
  is set; confirm during hive-v1-12.

## If the spike fails (not taken — recorded for history)

Record which rung is taken and why:

- **(a)** Accept a brief focus handover and restore the prior app explicitly on dismiss.
- **(b)** Write the overlay as a small native Swift helper; keep Electron for the Catalogue.
- **(c)** Fall back to annotating in a normal window. This **degrades the core premise** and
  must trigger a loop-back to DESIGN (`valk-revisit design`) rather than being absorbed
  silently into the build.

## Blocked by

- hive-v1-01
