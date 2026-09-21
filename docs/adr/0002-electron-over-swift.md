# ADR 0002 — Electron over Swift

Date: 2026-09-21
Status: Accepted

## Context

HiveAnnotate is, by volume, native-API work: global hotkeys, a transparent always-on-top panel
that must not steal focus, `CGWindowListCopyWindowInfo`, `CGPreflightScreenCaptureAccess`,
Secure Input detection, `screencapture`. On paper this is a Swift app, and choosing Electron for
it is the surprising decision that a future reader will want explained.

The counterweight is that every other repository the author maintains is TypeScript/React. A
Swift codebase would be the only one of its kind, maintained by one person, for a tool whose
purpose is to *save* that person time.

This ADR was deliberately deferred until the focus spike (hive-v1-02) resolved, because the
honest answer depended on whether Electron could do the one thing the product cannot live
without.

## Decision

**Electron with TypeScript and React, with native work isolated in a single Objective-C helper.**

The spike settled the load-bearing question: an Electron `type: 'panel'` window shown with
`showInactive()` and then focused becomes key and receives keystrokes **while the host app stays
frontmost** — 12/12 automated checks across TextEdit and Safari, plus real keystrokes over
iTerm2. That combination is normally mutually exclusive on macOS, and every screen in the
design depends on it.

Where Electron cannot reach, `packages/app/native/hive-helper.m` does: one file, one `clang`
invocation, no node-gyp. It enumerates windows, reports the Screen Recording grant, and reports
Secure Input. It is deliberately dumb — it enumerates and reports; every decision about *which*
window the user meant lives in TypeScript where it can be tested.

## Alternatives considered

- **Swift/SwiftUI.** Leaner, faster, no bundled runtime, first-class access to every API used
  here. Rejected on maintenance: it would be the only Swift codebase in the author's estate, and
  the ongoing cost of context-switching outweighs the runtime gain for a personal tool.
- **Tauri.** Smaller binaries, Rust core. Rejected for the same reason as Swift, with less
  ecosystem maturity for the specific window behaviours this product needs.
- **Electron with everything in a native addon.** Rejected as the worst of both: node-gyp
  rebuilds per Node version, and the native surface grows without bound.

## Consequences

**Good.** The UI is React, so the Catalogue and the capture bar are cheap to build and change.
Core logic is plain TypeScript, testable in a bare Node process — which is also what makes the
MCP server independent (ADR 0001). The native surface is one readable file.

**Bad, and accepted.** A bundled Chromium for a menu-bar utility: a large download and a
resident memory cost out of proportion to what the app does. Electron's own bugs are now in
scope — three of the four hardest bugs in the build were Electron seams, not product logic
(an ESM preload Electron refused to load, a sandboxed preload pulling in `node:fs`, and IPC
racing the renderer's first load). None were hard to fix, but all were invisible to unit tests
and cost real time.

**The hedge.** `CaptureBackend` and `CaptureBackend`-shaped interfaces exist from day one, so a
future move to ScreenCaptureKit — or to a native overlay if Electron's panel behaviour ever
regresses — is a port rather than a rewrite. That seam is also the Mac App Store hedge, should
distribution ever matter (it does not today; see the PRD).
