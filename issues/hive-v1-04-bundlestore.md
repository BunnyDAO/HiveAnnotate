---
id: hive-v1-04
title: BundleStore — the on-disk format, slugs, append/move/delete, bundle.md
type: AFK
status: done
blocked_by: [hive-v1-01]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The spine of the product. A deep module owning the entire on-disk format, with a small
interface hiding all of it. Pure filesystem — **no Electron, no macOS APIs** — so it is
testable in plain Node and reusable by the MCP server.

```
~/HiveAnnotate/bundles/<YYYY-MM-DD>-<slug>/
  manifest.json      # structured truth
  001.png 002.png …  # captures, in the order taken
  bundle.md          # rendered, human- and agent-readable
```

Operations: create a Bundle, append a Capture, read one, list them, move a Capture to another
or new Bundle, delete a Capture, edit a Note, edit the Intent, close a Bundle.

Slug generation derives from the first Capture's Note — which also seeds the Bundle's Intent.
Handle collisions and non-ASCII input.

Bundles are **global and time-ordered**, not scoped per project. This was a default decision
never put to the user (see PRD Risks); if per-project scoping is wanted later it is an
additive field on the manifest, not a restructure.

The folder is the source of truth. `bundle.md` is a rendering of the manifest, never a second
source — regenerate it on every mutation.

## Acceptance criteria

- [x] Create → append → read round-trips through disk with content intact. **(mandatory)**
- [x] Slug generation is deterministic, handles collisions, and handles non-ASCII and emoji first notes without producing an invalid directory name. **(mandatory)**
- [x] Captures keep their capture order across append, and numbering does not reuse a deleted index. **(mandatory)**
- [x] Moving a Capture between Bundles updates both manifests and both `bundle.md` files, and moves the image file. **(mandatory)**
- [x] Deleting a Capture leaves the Bundle valid; deleting the last Capture leaves a valid empty Bundle rather than a corrupt one. **(mandatory)**
- [x] `bundle.md` output is asserted against a golden file. **(mandatory)**
- [x] Every test runs against a temp directory; none touches the real `~/HiveAnnotate`. **(mandatory)**
- [x] A hand-corrupted or truncated `manifest.json` is reported as an error, never silently treated as an empty Bundle.

## Notes

- `BundleStore` takes its root as a constructor argument with **no default**, so no test can
  reach `~/HiveAnnotate` by accident. `defaultBundleRoot()` is the single place that knows the
  production location.
- A vacated capture number is never reissued — by deletion or by a move out. Reusing one would
  silently attach a previous observation's evidence to a new one.
- Editing the first Note does not re-seed the Intent. Seeding happens once, at creation; after
  that the Intent is its own thing.
- `editIntent` never recomputes the bundle id, so a pointer already handed to an agent still
  resolves.
- A damaged manifest is an error on read and a flagged entry in the listing — never silently
  an empty Bundle, which would look like the user's captures had vanished.

## Blocked by

- hive-v1-01
