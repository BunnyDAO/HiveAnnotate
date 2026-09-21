---
id: hive-v1-08
title: HotkeyService — global chords, Secure Input detection, menu-bar state
type: AFK
status: open
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

- [ ] All three chords fire from any frontmost app, including over a fullscreen app. **(mandatory)**
- [ ] A chord already taken by another app is reported at registration rather than failing silently. **(mandatory)**
- [ ] Secure Input state is detected and the menu-bar icon shows a distinct blocked state within a second of it engaging. **(mandatory)**
- [ ] The blocked state clears automatically when Secure Input releases, with no user action. **(mandatory)**
- [ ] Chord definitions live in one place and are changeable without touching handler code.
- [ ] Whether Accessibility permission is required for these chords is determined empirically and recorded in the issue — the research left it UNCERTAIN for non-media keys.

## Blocked by

- hive-v1-01
