---
id: hive-v1-16
title: Write the two deferred ADRs — pull-not-push, Electron over Swift
type: AFK
status: open
blocked_by: [hive-v1-02]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

Two architecture decision records under `docs/adr/`. Both were offered during the grilling
session and deferred rather than declined. Both are hard to reverse, both would puzzle a
future reader, and both were real trade-offs with live alternatives.

**ADR: handoff is pull, not push.** Why there is no daemon, no listener, no webhook and no
push integration — an agent's client spawns the MCP server itself and asks. Record what this
buys (zero uptime requirement, no integration to maintain per destination, works with tools
that do not exist yet) and what it costs (nothing happens until a human asks for it; there is
no "notify me" story). Record that clipboard was considered and rejected because a terminal
cannot paste an image.

**ADR: Electron over Swift.** For an app that is mostly native-API work, this is the
surprising choice and deserves its reasoning on the record: stack fit with the surrounding
repos versus a leaner, faster native implementation.

**Blocked by the spike deliberately.** The Electron ADR cannot be written honestly until
hive-v1-02 has established whether Electron can actually deliver the overlay. If the spike
lands on rung (b) — a native Swift overlay helper — this ADR documents a hybrid rather than a
straight choice, which is a materially different decision.

## Acceptance criteria

- [ ] Both ADRs exist under `docs/adr/`, numbered, following the repo's ADR format.
- [ ] Each states the context, the decision, the alternatives actually considered, and the consequences — including the negative ones.
- [ ] The Electron ADR reflects the real outcome of hive-v1-02, not the pre-spike assumption. **(mandatory)**
- [ ] Neither ADR is edited later to hide a reversal — a superseding decision gets its own ADR.

## Blocked by

- hive-v1-02
