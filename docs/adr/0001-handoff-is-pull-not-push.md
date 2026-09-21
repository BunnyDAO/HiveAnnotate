# ADR 0001 — Handoff is pull, not push

Date: 2026-09-20
Status: Accepted

## Context

A Bundle is only worth capturing if it reaches something that acts on it. The obvious design
is to push: the app sends the Bundle to an LLM, an issue tracker, a webhook. That is how most
"send to X" features work, and it is what the product's own v2 (a HiveOp adapter) looks like
from the outside.

Two things made pushing the wrong default.

**The terminal cannot paste an image.** The primary consumer is Claude Code in a terminal. The
natural push — copy the bundle to the clipboard — collapses there: the user ends up dragging
PNGs from a folder into the terminal, which is the exact friction the product exists to remove.
This was not a theoretical objection; it is how the user described their actual workflow.

**An agent reads files.** Claude Code's `Read` tool opens images from disk directly. The agent
never needed the bytes handed to it — it only ever needed to be told *where they were*. Once
that is true, pushing is not merely unnecessary, it is a worse way to deliver the same thing.

## Decision

**Handoff is pull. The core exposes Bundles and waits to be asked.**

The MCP server is a stdio subprocess that the agent's own client spawns when a session starts.
Nothing listens, nothing polls, there is no daemon, and HiveAnnotate does not need to be
running — the server reads the bundle folder off disk. `get_bundle` returns the intent, the
notes, and **absolute paths** to the images.

The clipboard survives only as a one-line *text* pointer (`use hive bundle <id>`), for
disambiguating "the latest" when several bundles are open.

## Alternatives considered

- **Clipboard as the primary path.** Rejected: a terminal cannot paste an image.
- **Watched folder.** An agent polls a directory. Works unattended, but the user gets no
  feedback that anything happened and cannot choose which agent picks it up.
- **Push notification over MCP.** Mark the bundle ready and signal connected agents. Rejected
  because it requires an agent to be connected and listening — "right then" quietly degrades
  into "whenever something checks". The user objected to this directly: *"I don't want agents
  to be having to just sit there and listen."*
- **Direct integrations per destination.** Rejected: every destination becomes code this
  project maintains forever, and tools that do not exist yet are unreachable by construction.

## Consequences

**Good.** No uptime requirement: the handoff works with the app closed. No integration to
maintain per destination. Any MCP-speaking tool works without HiveAnnotate knowing it exists.
"Right then" and "later" stop being two features — they are the same mechanism, differing only
in how long the user waits before asking.

**Bad, and accepted.** Nothing happens until a human asks. There is no "notify me" story and
no way to make a bundle interrupt someone. A user who expects fire-and-forget will find this
inert. That is the correct trade for a tool whose whole premise is not interrupting you.

**Load-bearing.** This decision is why `packages/mcp` depends on `packages/core` alone and must
run with Electron absent, and why the on-disk format is boring and open. Reversing it would not
be a refactor; it would be a different product.
