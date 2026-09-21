# HiveAnnotate v1

Domain: standalone product. Glossary: [`CONTEXT.md`](../../CONTEXT.md).
Verified platform constraints: [`docs/research/macos-capture-constraints.md`](../research/macos-capture-constraints.md).
Design canvas (5 artboards, reviewed): https://claude.ai/artifact/6yBYnN4NvJpCNnB8bmBEi3

## Problem Statement

While building, I take a lot of screenshots of things that are wrong. The intent behind each
one — what I actually wanted done about it — lives only in my head and never reaches disk.

I pay for that twice. Once in **latency**: capture, wait for the file to land, find it, drag
it into an LLM, and only *then* think about what I wanted. Once in **loss**: a folder of
unnamed PNGs where I can't tell what number fourteen was for, so the small bugs quietly stop
getting captured at all because capturing one isn't worth the trouble.

The tool I need does not exist as a screenshot app. Screenshot apps optimize the image.
The image was never the hard part.

## Solution

Screenshot any part of the desktop without a mouse, annotate it instantly in the same
keystroke sequence, keep it in a Catalogue, and hand it off to an LLM seamlessly — right then
or later.

Three things follow from that sentence, and they are the whole product:

1. **The annotation happens at capture time.** A gallery you annotate later rebuilds the
   problem it was meant to solve. The Catalogue is for review, correction and handoff — never
   for primary annotation.
2. **The unit is a Bundle, not a screenshot.** One thing you want an LLM to do is often three
   images: the broken state, the console, the expected state.
3. **Handoff is pull, not push.** Nothing listens, nothing polls, no daemon. An agent asks
   for a Bundle when its user tells it to.

### Success bar

A personal tool, built clean enough to ship later. Explicitly **not** a product with day-one
users. This removes first-run onboarding, a settings UI, distribution work and a support
story from v1 — but does *not* remove code signing (see Implementation Decisions).

## User Stories

1. As a developer mid-debug, I want to capture the window I'm looking at with one chord, so
   that I don't break flow reaching for a mouse.
2. As a developer, I want to capture an arbitrary rectangle using only the keyboard, so that
   "any part of the desktop" is literally true and not just "whole windows".
3. As a developer, I want to capture the whole screen with one chord, so that the case with
   no decision at all is the cheapest case.
4. As a developer, I want an annotation field focused and waiting the instant the shutter
   fires, so that the intent is recorded while I still hold it.
5. As a developer, I want to type that annotation without the app I'm debugging losing focus
   or changing state, so that capturing evidence never disturbs the thing I'm inspecting.
6. As a developer, I want my capture filed automatically into whatever problem I'm currently
   working on, so that I make zero decisions at the moment I can least afford one.
7. As a developer who wandered off for an hour, I want my next capture to start a fresh
   Bundle rather than silently joining an unrelated one, so that my Bundles never become lies.
8. As a developer, I want the first thing I type to become the Bundle's name and intent, so
   that a one-capture Bundle costs exactly one sentence and nothing more.
9. As a developer, I want to add several captures to one problem, so that the agent receives
   evidence rather than a single ambiguous frame.
10. As a developer, I want to browse my Bundles in a Catalogue, so that a problem I saw at
    2pm is still actionable at 6pm.
11. As a developer, I want to move a capture into a different Bundle, so that automatic
    filing is safe to rely on because it is trivial to correct.
12. As a developer, I want to edit any note and the Bundle intent, so that I can sharpen a
    hasty sentence before an agent acts on it.
13. As a developer, I want to delete a capture, so that a bad screenshot doesn't mislead an
    agent.
14. As a developer in Claude Code, I want to say "grab the latest hive bundle" and have the
    agent read the intent, the notes and the images itself, so that I never drag a file into
    a terminal again.
15. As a developer, I want that to work with no HiveAnnotate process running, so that the
    handoff has no uptime requirement.
16. As a developer with several open Bundles, I want to copy a short text pointer to one, so
    that I can disambiguate "the latest" by pasting a line into a terminal.
17. As a developer, I want an agent to mark a Bundle handled when the work lands, so that the
    Catalogue drains itself instead of becoming the PNG graveyard I already have.
18. As a developer, I want my Bundles on disk in a format I could read with `cat`, so that I
    am never locked into this tool.
19. As a developer, I want to reveal a Bundle's folder, so that any tool that takes files can
    consume it.
20. As a developer who has not granted Screen Recording, I want to be told before the
    capture, so that I never annotate a picture of my wallpaper and hand it to an agent.
21. As a developer whose target window closed mid-capture, I want the bar to appear anyway
    holding the sentence I already typed, so that the failure costs me the image and not the
    thought.
22. As a developer whose disk is full, I want to be told loudly, so that I never believe a
    capture was saved when it wasn't.
23. As a developer whose hotkey silently did nothing, I want the menu bar to tell me Secure
    Input is blocking it, so that I don't conclude the app is broken.
24. As the maintainer, I want every destination behind one Adapter interface, so that adding
    HiveOp later never requires the core to learn what HiveOp is.
25. As the maintainer, I want capture behind a CaptureBackend interface, so that a future
    Windows port or a ScreenCaptureKit rewrite is a port and not a rewrite.
26. As the maintainer, I want the Screen Recording grant to survive my rebuilds, so that
    developing this app is not a permissions treadmill.

## Implementation Decisions

### Modules

Deep modules first — small interfaces, meaningful behavior hidden, tested in isolation.

| Module | Responsibility | Depends on | Independent? |
|---|---|---|---|
| **BundleStore** | The entire on-disk format. Create/append/read/list Bundles, move + delete Captures, slug generation, `manifest.json` and `bundle.md` rendering. The source of truth. | — | **Yes** — pure filesystem, no Electron, no macOS |
| **ActiveBundlePolicy** | The staleness rule: given the active Bundle, last-capture time and now, decide append-or-open-new. | — | **Yes** — pure function, clock injected |
| **WindowLocator** | Frontmost window's `CGWindowID` + bounds, via `CGWindowListCopyWindowInfo` + `NSWorkspace.frontmostApplication`. Small native helper. | — | **Yes** — native module, testable standalone |
| **CaptureBackend** | Interface + macOS implementation. Hides `screencapture` invocation, permission pre-flight, retina handling, failure classification. | WindowLocator | Interface first; impl after |
| **HotkeyService** | Global shortcut registration; Secure Input state detection. | — | **Yes** |
| **CaptureOverlay** | The panel window: region grid picker, annotation bar, all failure states. | CaptureBackend, BundleStore, **the spike** | **No** — gated on spike |
| **CatalogueWindow** | Browse, correct, hand off. | BundleStore, AdapterRegistry | Mostly |
| **AdapterRegistry** | The one destination interface + folder-reveal and clipboard-pointer adapters. | BundleStore | **Yes** |
| **McpServer** | Separate stdio entry point. `list_bundles`, `get_bundle`, `close_bundle`. | BundleStore **only** | **Yes** — must run without Electron |

The parallelism map: **BundleStore, ActiveBundlePolicy, WindowLocator, HotkeyService,
AdapterRegistry and McpServer are all independently buildable.** Only CaptureOverlay is
genuinely blocked, and it is blocked on a spike rather than on other code.

### Capture

- Three hotkeys: **⌥1** focused window (`screencapture -l <windowid>`), **⌥2** full screen
  (`-x`), **⌥3** keyboard region picker resolving to `-R x,y,w,h`. All flags verified against
  `man screencapture`; `-i` is unusable because it requires a mouse drag.
- Region picker: subdividing 3×3 grid, `QWE`/`ASD`/`ZXC`, `⏎` capture, `⌫` back a level,
  `⇧`+arrows nudge an edge, `⎋` cancel.
- **Unresolved tension — see Risks.** The design currently treats focused-window as the
  dominant path and region as a fallback. The locked intent says "any part of the desktop",
  which argues they are co-primary.
- Shell out to `screencapture`, not Electron's `desktopCapturer` — speed and true Retina
  resolution. Captures never touch the Desktop or Preview.
- **Window IDs need no Screen Recording grant.** `CGWindowListCopyWindowInfo` returns the ID
  and bounds ungated; only the window *title* is withheld (verified). The `active-win` npm
  package is stale and its id was not verified as a usable `CGWindowID` — build the small
  native helper instead.

### Annotation and Bundles

- Notes are **freeform prose**. Structured expected/actual/severity rejected: slower at the
  one moment speed is the premise, and it cannot seed a name or an Intent.
- **The first Capture's Note seeds both the Bundle's Intent and its slugified name.** The
  user is never prompted for an Intent. Editing it later is an enhancement, not an obligation.
- At most one **Active Bundle**; captures append with no question asked.
- The Active Bundle goes **stale after 20 minutes** with no captures (tunable constant). The
  next capture opens a fresh Bundle and says so in the bar.
- Catalogue corrections in v1: move a Capture to another or new Bundle, edit any Note, edit
  the Intent, delete a Capture.

### Storage

```
~/HiveAnnotate/bundles/<YYYY-MM-DD>-<slug>/
  manifest.json      # structured truth
  001.png 002.png …  # captures, in the order they were taken
  bundle.md          # rendered, human- and agent-readable
```

The **folder is the source of truth**. Everything degrades to reading a path. No database.

- Bundles are **global and time-ordered**, not scoped per project (default decision, see
  Risks — this was never put to the user).
- No retention policy in v1. Nothing is auto-deleted.

### Handoff

- **Pull, never push.** Claude Code spawns the MCP server itself as a stdio subprocess per
  session. Nothing listens, nothing polls, no daemon, and **HiveAnnotate need not be
  running** — the server reads the bundle folder off disk.
- `get_bundle` returns the intent, the notes, and **absolute image paths**. Claude Code's
  `Read` tool opens images from disk directly, which is the fact that removes drag-and-drop
  entirely.
- `close_bundle` lets the agent mark a Bundle handled so the Catalogue drains itself.
- **Clipboard rejected as the primary path** — a terminal cannot paste an image. Retained
  only as `⌘⏎` copying a one-line *text* pointer for disambiguating "the latest".
- Every destination sits behind one **Adapter** interface. HiveOp is v2 and must not
  special-case the core; if it ever needs to, the agnostic claim has already failed.

### Failure behavior

Three rules, and they are absolute:

1. **The bar always appears**, including on failure.
2. **The already-typed Note is never discarded** — a failed capture costs you the image, not
   the thought. Retry aims at the note.
3. **Nothing steals focus, even when failing.** No modals, no notifications.

Specific guards:

- **Screen Recording is checked pre-flight** (`CGPreflightScreenCaptureAccess`). Without the
  grant `screencapture` does *not* error — it succeeds and returns the desktop wallpaper with
  every window stripped out (verified). That is worse than a crash and must never reach the
  user.
- **Secure Input** (a focused password field, 1Password) blocks hotkeys system-wide with no
  app-side workaround (verified). The hotkey never arrives, so the bar cannot appear — the
  menu bar icon carries that state instead.
- Stale window ID → offer full-screen capture as the recovery.
- Write failure → the capture is held in memory and the bar refuses to close on its own.

### Platform and distribution

- **Electron + TypeScript/React**, chosen for stack fit across the user's existing repos over
  Swift or Tauri. Deferred ADR.
- **`CaptureBackend` interface from day one**; macOS is the only implementation. No
  Windows/Linux ports are built.
- **Not the Mac App Store.** The sandbox forbids what this app is made of; CleanShot X,
  Shottr and Xnapper all ship direct (verified). Signed + notarized Developer ID direct
  download.
- **Developer ID is needed on day one regardless of distribution** — unsigned dev builds pin
  the TCC grant to a per-build cdhash, so the Screen Recording permission is invalidated on
  *every rebuild* (verified). The $99 buys a working development loop before it buys
  distribution.
- TCC attributes a child process's access to the top-level parent, so the **Electron app**
  holds the grant, not the transient `screencapture` subprocess (verified).

## Testing Decisions

Test external behavior, never internals. The three modules below carry real logic and are
where the tests go:

- **BundleStore (mandatory).** Round-trip a Bundle through disk. Slug generation including
  collisions and non-ASCII first notes. Append ordering. Move a Capture between Bundles.
  Delete. `bundle.md` rendering is asserted against a golden file. Runs against a temp dir.
- **ActiveBundlePolicy (mandatory).** A pure function with an injected clock — the full truth
  table: no active bundle, fresh bundle, bundle exactly at the staleness boundary, long-stale
  bundle. This is the decision most likely to silently corrupt a Bundle, and it is the
  cheapest thing in the codebase to test exhaustively.
- **McpServer (mandatory).** Driven against a temp bundle directory with no Electron present
  — that independence *is* the feature. Assert `get_bundle` returns absolute, existing paths.
- **CaptureBackend.** Tested against a fake `screencapture` on `PATH`, asserting argument
  construction per target type and correct classification of each failure mode.

Not unit-tested in v1: CaptureOverlay and CatalogueWindow. UI correctness here is a matter of
focus behavior and feel, which the spike and manual use settle better than assertions would.

## Out of Scope

- **Any LLM call.** HiveAnnotate never talks to a model.
- **The HiveOp adapter** — v2. Where screenshots live server-side is genuinely undesigned:
  the `wenrwa-marketplace` MCP takes text, and image hosting for issue attachments has no
  answer yet. Shipping the adapter before solving that would force a special case into the
  core.
- **Merge two Bundles** — cut. Moving captures one at a time covers it.
- Reordering captures (chronological order is information), splitting Bundles, tags, folders.
- Windows and Linux capture backends.
- Mac App Store submission.
- First-run onboarding, a settings UI, auto-update, and a support story — consequences of the
  personal-tool success bar, revisit only if the bar changes.
- Video capture, OCR, image editing, arrows/blur/redaction markup.
- Retention, auto-cleanup, sync, or any server component.

## Further Notes

### Risks and open questions

- **THE SPIKE — overlay focus. Blocks all UI work.** The capture overlay must receive
  keystrokes *without* stealing focus from the app being debugged. On macOS these are
  normally mutually exclusive: the standard non-stealing overlay is an `NSPanel` that refuses
  `canBecomeKeyWindow`, and a window that cannot become key cannot receive keys. Electron PR
  #40307 (Electron 28+, Sonoma+) suppresses `activateIgnoringOtherApps` for `type: 'panel'`
  windows and is the one known mechanism that threads it — **cross-version reliability and
  focus-return behavior are unverified.** Focus-return will likely need capturing the
  previously-frontmost app's PID and calling `NSRunningApplication.activate()` by hand.
  Every screen in the design depends on this. Spike it before any UI is committed.

  **If the spike fails**, in descending order of preference: (a) accept a brief focus
  handover and restore the prior app explicitly on dismiss; (b) write the overlay as a small
  native Swift helper and keep Electron for the Catalogue; (c) fall back to annotating in a
  normal window, which degrades the core premise and should trigger a loop-back to DESIGN
  rather than being absorbed silently.

- **Region picker vs focused window.** The design treats window-capture as dominant and
  region as a fallback, but the locked intent says "any part of the desktop". If region is
  actually co-primary, it deserves equal polish and possibly the more ergonomic chord. Needs
  a call before issue breakdown.

- **Bundle scoping.** Defaulted to global and time-ordered because "the latest" is almost
  always right. With ~250 repos, per-project scoping might matter more than assumed. Never
  put to the user.

- **Catalogue window shape.** Strongly implied to be a window opened from a menu-bar
  background app (`LSUIElement`), since global hotkeys require an always-running process.
  Never explicitly confirmed.

- **Active Bundle across restart/reboot.** Undecided. Suggest persisting it with its
  last-capture timestamp so the staleness rule survives a restart, but this was not discussed.

### Deferred ADRs

Offered during the grill, deferred rather than declined — both are hard to reverse and both
would puzzle a future reader:

- Pull-not-push as the handoff model.
- Electron over Swift for an app that is mostly native-API work.
