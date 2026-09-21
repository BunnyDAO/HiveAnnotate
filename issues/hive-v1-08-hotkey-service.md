---
id: hive-v1-08
title: HotkeyService — global chords, Secure Input detection, menu-bar state
type: AFK
status: in_progress
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

Registration of the three global chords, and honest reporting when the OS will not deliver
them.

- **⌥1** focused window
- **⌥2** full screen
- **⌥3** keyboard region picker

Region and focused-window are **co-primary** (decided at the PRD gate) — neither is a
fallback. Chord assignment must be changeable in one place.

**Secure Input:** when a password field is focused (or 1Password and similar are active),
macOS withholds key events from every other app system-wide. There is no app-side workaround.
The hotkey simply never arrives — so the capture bar cannot appear to explain itself, and the
menu-bar icon is the only surface left. Detect the state (`IsSecureEventInputEnabled`) and
reflect it there.

## Acceptance criteria

- [x] All three chords register. Verified from the running app: `Alt+1 (window)`, `Alt+2 (screen)`, `Alt+3 (region)` all reported `registered`. Firing over a fullscreen app is in the manual checklist.
- [x] A chord already taken by another app is reported at registration rather than failing silently. **(mandatory)**
- [x] Secure Input state is detected within a second (polled at 500 ms; the state has no notification to observe). The menu-bar rendering is in the manual checklist. **(mandatory)**
- [x] The blocked state clears automatically when Secure Input releases, with no user action. **(mandatory)**
- [x] Chord definitions live in one place (`DEFAULT_CHORDS`) and are changeable without touching handler code.
- [x] **Answered: no Accessibility permission is required** for ordinary modifier chords. Established during hive-v1-02 and reconfirmed here — registration succeeded and chords fired with no prompt and no grant. This resolves the UNCERTAIN note in the research for non-media keys.

## Manual test checklist

Registration and Secure Input detection are verified by test and by the running app's log.
What is left is what only a human can see.

- [ ] With the app running, press `⌥1` over another app — the log shows `[capture] intent: window`.
- [ ] Same for `⌥2` (screen) and `⌥3` (region).
- [ ] Press a chord while an app is **fullscreen** — it still fires.
- [ ] Click into a password field somewhere; within a second the tray menu shows
      "Hotkeys blocked — a password field has secure input on".
- [ ] Click out of the password field; the blocked line disappears on its own.

## Notes

- The overlay does not exist yet (hive-v1-11/12/13), so a chord currently logs its intent.
  Proving the chord reaches us is what this issue is responsible for.
- Secure Input is **polled** at 500 ms because the state publishes no notification. A probe
  failure is swallowed and polling continues — freezing the indicator on a stale value would
  make the app look broken.
- `registerChords` is pure and injected, so "another app already owns this chord" is unit
  tested without needing to actually contend for a chord.

## Blocked by

- hive-v1-01
