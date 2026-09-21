# macOS capture constraints — verified findings

Status: research input for DESIGN. Not decisions. Verified 2026-09-20.

## screencapture(1) flags (verified locally, `man screencapture`)

- `-l <windowid>` — capture a specific window by CGWindowID.
- `-R x,y,w,h` — capture an arbitrary rectangle. **No mouse required.**
- `-i` — interactive; REQUIRES mouse drag. Unusable for keyboard-only.
- `-x` no sound, `-o` no window shadow, `-C` include cursor, `-r` strip dpi metadata,
  `-t <fmt>`, `-D <display>`, `-c` to clipboard.

Conclusion: the three-hotkey plan (focused window / full screen / computed rect)
is mechanically supported without interactive mode.

## Window ID acquisition

- `CGWindowListCopyWindowInfo` returns `kCGWindowNumber` (the ID), bounds, layer and
  owner PID **without Screen Recording permission and without prompting**.
- Only `kCGWindowName` (the title) is withheld without the grant.
  Whether `kCGWindowOwnerName` is also gated: UNCERTAIN.
- `active-win` npm appears stale (~2yr); whether its `id` is a literal CGWindowID
  usable with `screencapture -l` was NOT verified.
- Recommended: small native helper calling `CGWindowListCopyWindowInfo` directly,
  cross-referenced with `NSWorkspace.frontmostApplication` PID.

## TCC permission across builds  ← affects day-one tooling

- The grant is keyed to the code-signing identity (bundle ID + Team ID cert chain),
  not to the toggle in System Settings.
- **Ad-hoc / unsigned dev builds pin to a per-build cdhash, so the Screen Recording
  grant is invalidated on EVERY rebuild.** Well-documented Electron pain point.
- Stable Developer ID + consistent bundle ID/Team ID avoids re-prompts across updates.
- Responsible-process model: TCC attributes a child process's access up the tree to the
  top-level parent. So the **Electron app** holds the grant, not the transient
  `screencapture` subprocess.

## Global hotkeys

- Electron docs confirm Accessibility trust is required for **media-key** accelerators.
  Whether ordinary letter+modifier combos also require it: UNCERTAIN.
- **Secure Input mode** (password fields, 1Password, etc.) blocks ALL other apps'
  global key monitoring system-wide until released. Real failure mode, no app-side
  workaround. Needs a visible degradation story.

## Overlay focus  ← HIGHEST UNCERTAINTY IN THE DESIGN

- The standard "never steal focus" overlay pattern (NSPanel refusing
  `canBecomeKeyWindow`, nonactivating panel style) **cannot receive keyboard input**.
  The two goals are normally mutually exclusive.
- Electron PR #40307 (Electron 28+, Sonoma+) suppresses `activateIgnoringOtherApps`
  when `.focus()` is called on a `type: 'panel'` window, letting a panel become key
  without fully reordering/activating. Closest available mechanism.
- Cross-version reliability and focus-RETURN behavior NOT independently verified.
- Reliable focus-return likely requires capturing the previously-frontmost app's PID
  and calling `NSRunningApplication.activate()` manually.
- **Flagged: needs a prototype spike before committing architecturally.**

## Mac App Store

- Non-interactive `screencapture` shell-out (incl. `-l`) works under App Sandbox.
  Only `-i` trips a sandbox denial.
- No standard sandbox entitlement for screen capture; Apple points to ScreenCaptureKit.
- CleanShot X, Shottr, Xnapper are NOT on MAS (direct download / Setapp only).
- Shelling to a system binary brushes Guideline 2.4.5(iv); approval odds UNCERTAIN.
- Moot while the product is a personal tool. Revisit only if distribution becomes a goal.
