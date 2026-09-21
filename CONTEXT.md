# CONTEXT

The glossary for HiveAnnotate. Terms only — no implementation details, no decisions.
Decisions live in `docs/adr/`, the PRD, and the issues.

## Intent (locked 2026-09-20)

Screenshot any part of the desktop without a mouse, annotate it instantly, keep it in a
Catalogue, and hand it off to an LLM seamlessly — either right then or later.

Domain: a standalone product. HiveAnnotate owns Capture, Annotation, Bundle, Catalogue and
the Adapter interface. It does not own LLM calls, issue creation, or HiveOp.

## Terms

### Capture
One screenshot, taken by one hotkey press. Carries its own Note and the facts about how it
was taken (window / screen / region, source app, dimensions, time).

A Capture is never a loose file on the Desktop. It is born inside a Bundle.

### Note
The freeform text attached to a single Capture, typed at capture time. Describes *this
image* — what is wrong in it, or what it is evidence of.

Not to be confused with **Intent**, which is bundle-level.

Freeform prose, not structured fields. Structure (expected / actual / severity) was rejected:
it is slower to type at the one moment speed is the entire premise, and it cannot seed an
Intent or a Bundle name naturally.

### Bundle
**One problem.** Holds one or more Captures plus a single Intent. The Bundle — never the
individual Capture — is the unit that gets handed off.

A Bundle exists because one thing you want an LLM to do is often several screenshots: the
broken state, the console, the expected state.

### Intent
The bundle-level instruction: what the user wants done about this problem. One per Bundle.

Distinct from a Note. A Note says "the sidebar is at zero width here"; an Intent says "keep
the nav pinned while a modal is up, and fix it at the mount, not with CSS".

**Seeded, never prompted for.** The first Capture's Note becomes the Bundle's Intent and the
source of its name. The user is never asked to fill an Intent field — editing it in the
Catalogue is an enhancement made when there is something to add, not an obligation. A
one-Capture Bundle therefore costs exactly one sentence, total.

### Active Bundle
The Bundle that a new Capture is appended to without the user being asked. There is at most
one. Choosing a Bundle is a correction made after the fact, never a decision made at capture
time.

An Active Bundle goes **stale** after a period with no Captures (default 20 minutes). The
next Capture after that opens a new Bundle rather than appending to the stale one, and says
so. Staleness exists so a mis-filed Capture is prevented without asking the user a question
at the moment they can least afford one.

### Catalogue
The durable, browsable collection of Bundles.

*Canonical term.* "Library", "gallery" and "catalog" all mean this — prefer **Catalogue**.
It is explicitly **not** the place annotation happens; annotation happens at capture time.
The Catalogue is for review, correction, grouping and Handoff.

### Handoff
Moving a Bundle to something that will act on it. Has two modes, and both are required:

- **Immediate** — handed off in the same keystroke sequence as the capture.
- **Deferred** — handed off later, from the Catalogue.

### Adapter
A destination for a Handoff. The core knows the Adapter *interface* and never knows what any
particular destination is.

HiveOp is one Adapter. If it ever needs a special case inside the core, the product is no
longer agnostic and the design has failed.

### Capture Backend
The platform-specific implementation of taking a Capture. macOS is the only one that exists.
The term exists so that "add Windows" is a port and not a rewrite.
