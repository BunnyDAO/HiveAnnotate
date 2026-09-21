---
id: hive-v1-09
title: AdapterRegistry — one destination interface, folder-reveal + clipboard pointer
type: AFK
status: open
blocked_by: [hive-v1-01, hive-v1-04]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The single interface every Handoff destination sits behind, plus the two v1 adapters.

- **Folder / reveal** — open the Bundle's directory in Finder. Any tool that takes files can
  consume it from there.
- **Clipboard text pointer** — `⌘⏎` copies a one-line pointer such as
  `use hive bundle 2026-09-20-sidebar-collapse`. **Images are deliberately NOT copied**: a
  terminal cannot paste an image, which is the reason clipboard was rejected as the primary
  handoff path. The pointer exists only to disambiguate "the latest" when several Bundles are
  open.

The core must not know what any particular destination is. HiveOp arrives in v2 through this
same interface — **if it ever requires a special case in the core, the agnostic claim has
already failed** and that is a design regression, not an implementation detail.

## Acceptance criteria

- [ ] Both adapters are registered and invoked purely through the interface, with no destination-specific branching in the core. **(mandatory)**
- [ ] Reveal opens the correct Bundle directory.
- [ ] The clipboard pointer is plain text, is a single line, and contains no image data. **(mandatory)**
- [ ] The pointer round-trips: the id it names resolves to exactly that Bundle via BundleStore. **(mandatory)**
- [ ] A third, test-only adapter can be added and exercised without modifying any core module. **(mandatory)**
- [ ] An adapter that throws does not take down the app or lose the Bundle.

## Blocked by

- hive-v1-01
- hive-v1-04
