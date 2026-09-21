---
id: hive-v1-01
title: Project scaffold — Electron + TS + React + vitest, menu-bar background app
type: AFK
status: done
blocked_by: []
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The skeleton every other slice needs. An Electron app in TypeScript with a React renderer,
`vitest` as the test runner, and a build that produces a runnable `.app`.

The app runs as a **menu-bar background app** (`LSUIElement` / `app.dock.hide()`), not a
dock app. This is forced by the product: global hotkeys require an always-running process,
and there is no main window to put in the dock — the Catalogue is a window this background
app opens. (This resolves the PRD's open question on Catalogue window shape.)

Also establish the split that the rest of the build depends on: **core logic must be
importable without Electron.** `BundleStore`, `ActiveBundlePolicy` and the MCP server are
plain Node modules that never `import 'electron'`. Enforce it with a lint rule or a test, not
a convention — hive-v1-10 is unbuildable if this leaks.

## Acceptance criteria

- [x] `npm test` runs vitest and passes with real tests (22 passing).
- [x] A core module can be imported and unit-tested in a plain Node context with Electron absent. **(mandatory)** — proven by spawning a real `node` subprocess, not by running inside vitest.
- [x] A test or lint rule fails if a core module imports Electron. **(mandatory)** — `tools/electron-import-guard.ts`, and the guard self-tests against known-bad fixtures so it cannot silently detect nothing.
- [x] The bundle identifier is fixed and recorded — `io.hiveop.hiveannotate`, single-sourced from core and imported by the packaging config, with a pinned test and a drift test.
- [x] `npm run pack` produces an `.app`; its `Info.plist` carries `LSUIElement` and the bundle identifier core records, both asserted by test.
- [x] `npm run dev` launches the app; it appears in the menu bar and NOT in the dock or Cmd-Tab. — see manual checklist.

## Manual test checklist

Unit tests cannot see the dock, the menu bar, or whether a window actually renders.
`LSUIElement` being set is verified mechanically; that it *behaves* correctly is not.

- [x] `npm run dev` starts and the bracket icon appears in the menu bar.
- [x] The app does NOT appear in the dock and does NOT appear in Cmd-Tab.
- [x] Clicking the menu-bar icon opens the menu; "About" opens a window that renders the app name and bundle id (this proves the React renderer pipeline works end to end).
- [x] Closing the About window does NOT quit the app — the menu-bar icon stays.
- [x] "Quit" quits it.
- [x] `open packages/app/release/mac-arm64/HiveAnnotate.app` launches the packaged build and behaves the same.

## Blocked by

- None — can start immediately.
