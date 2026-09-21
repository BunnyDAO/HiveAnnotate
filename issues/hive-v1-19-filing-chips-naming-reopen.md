---
id: hive-v1-19
title: Filing chips, a required bundle name, and reopening a handled bundle
type: AFK
status: done
blocked_by: [hive-v1-18]
parent: docs/prd/hiveannotate-v1.md
follows_up: hive-v1-18
---

## What to build

From real use, three changes.

1. **Filing choices are visible chips** under the note: the default preselected, the other
   open bundles, then **+ New bundle** last. Tab / Shift+Tab or a click moves between them.
   New bundle first sat second, splitting the existing bundles in two; last is where "add"
   lives in most lists, and one Shift+Tab from the default wraps straight to it.
2. **A new bundle has a required name the user types.** Choosing + New bundle shows an empty
   *Bundle name* field. It cannot be saved empty; Enter on the note moves the cursor to it.
   (It was first prefilled from the note and mirrored it while typing; the user rejected that —
   the note says what is broken, the name says which bucket it goes in.)
3. **A bundle marked handled can be reopened.** The Catalogue's *Mark handled* becomes
   *Reopen* on a closed bundle.

## Change to a PRD decision

The PRD said the first Note seeds the bundle's name and intent and the user is never prompted.
In real use the user treats bundles as **named buckets** ("To do Bundle #1") as often as single
problems, so the name is now explicit and typed. The cost: a capture that starts a new bundle
takes one more field.

## Acceptance criteria

- [x] New bundle is offered, last in the row (verified in the running app).
- [x] Choosing it shows an **empty** name field — not a copy of the note.
- [x] Enter on the note, with no name yet, moves the cursor to the name field and saves nothing.
- [x] A typed name names the bundle, and the note stays on the capture.
- [x] A new bundle cannot be saved without a name — refused, and nothing is created.
- [x] One Shift+Tab from the default reaches + New bundle.
- [x] A handled bundle can be reopened (`closed` → `open`, on disk).

## Blocked by

- hive-v1-18
