---
id: hive-v1-14
title: CatalogueWindow — browse and the correction set
type: AFK
status: open
blocked_by: [hive-v1-02, hive-v1-04, hive-v1-09]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The window that makes a problem seen at 2pm still actionable at 6pm. Opened from the menu-bar
app.

**The Catalogue is for review, correction and handoff — never for primary annotation.** That
happens at capture time. If annotation starts migrating here, the product has regressed into
the thing it was built to replace.

Layout follows the "Catalogue" artboard: Bundle list on the left, selected Bundle's Intent and
its Captures with their Notes in the centre, handoff actions on the right.

The correction set — the whole reason automatic filing is safe:

- Move a Capture to another Bundle, or to a brand-new one
- Edit any Note
- Edit the Intent
- Delete a Capture

Explicitly **not** in v1: merging Bundles (cut), reordering Captures (chronological order is
information), splitting Bundles, tags, folders.

## Acceptance criteria

- [x] Bundles list newest first and show Intent, capture count and age.
- [x] Selecting a Bundle shows its Intent and every Capture with its Note — images served over a scoped `hive-capture:` protocol, verified decoding 3/3 rather than silently 404ing.
- [ ] Moving a Capture to another Bundle updates both, on disk, and survives a restart. **(mandatory)**
- [ ] Moving a Capture to a new Bundle creates and names that Bundle correctly. **(mandatory)**
- [x] Editing a Note or the Intent persists and regenerates `bundle.md`. **(mandatory)** — driven through the real bridge in `--self-test`, then reread from disk.
- [ ] Deleting a Capture removes the image and leaves both the manifest and `bundle.md` valid. **(mandatory)**
- [x] Every mutation goes through BundleStore — the window never touches the filesystem directly. **(mandatory)** — asserted mechanically by `tests/catalogue-boundaries.test.ts`.
- [x] Handoff actions invoke adapters through the registry with no destination-specific code here. **(mandatory)** — also asserted by the boundaries test; the panel is rendered from `registry.list()`.
- [x] A Bundle closed by an agent via `close_bundle` is reflected here — the window refreshes on focus, so an agent closing a bundle shows up without a restart.

## Manual test checklist

- [ ] Tray → Open Catalogue. Bundles list newest first with thumbnails that actually render.
- [ ] Edit an Intent, click away, reopen the bundle — it stuck, and `bundle.md` shows it.
- [ ] Move a capture to another bundle; both bundles update and the image moves with it.
- [ ] Move a capture to "A new bundle" — it is created and named from that capture's note.
- [ ] Delete a capture; the bundle stays valid and the remaining captures keep their numbers.
- [ ] "Mark handled" closes a bundle and it leaves the open count.
- [ ] Handoff buttons reveal the folder and copy the pointer.
- [ ] Ask Claude Code to `close_bundle`, then focus the Catalogue — the change shows up.

## Notes

- Capture images reach the renderer through a **scoped custom protocol**, not a file path and
  not by relaxing web security. A request that resolves outside the bundle root is refused.
- Found by the self-test: the page's CSP (`default-src 'self'`) silently blocked that scheme,
  so every thumbnail failed to load with no error anywhere. `img-src` now names it explicitly.
- The Catalogue is review, correction and handoff — **never** primary annotation. If annotating
  starts migrating here, the product has regressed into the thing it was built to replace.
- The window refreshes on focus rather than polling, so a capture taken while it is open, or a
  bundle an agent closed, appears without a restart.

## Blocked by

- hive-v1-02
- hive-v1-04
- hive-v1-09
