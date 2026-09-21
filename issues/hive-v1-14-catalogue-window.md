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

- [ ] Bundles list newest first and show Intent, capture count and age.
- [ ] Selecting a Bundle shows its Intent and every Capture with its Note.
- [ ] Moving a Capture to another Bundle updates both, on disk, and survives a restart. **(mandatory)**
- [ ] Moving a Capture to a new Bundle creates and names that Bundle correctly. **(mandatory)**
- [ ] Editing a Note or the Intent persists and regenerates `bundle.md`. **(mandatory)**
- [ ] Deleting a Capture removes the image and leaves both the manifest and `bundle.md` valid. **(mandatory)**
- [ ] Every mutation goes through BundleStore — the window never touches the filesystem directly. **(mandatory)**
- [ ] Handoff actions invoke adapters through the registry with no destination-specific code here. **(mandatory)**
- [ ] A Bundle closed by an agent via `close_bundle` is reflected here.

## Blocked by

- hive-v1-02
- hive-v1-04
- hive-v1-09
