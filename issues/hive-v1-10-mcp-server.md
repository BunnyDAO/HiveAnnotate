---
id: hive-v1-10
title: McpServer — standalone stdio server that runs with Electron absent
type: AFK
status: open
blocked_by: [hive-v1-01, hive-v1-04]
parent: docs/prd/hiveannotate-v1.md
---

## What to build

The handoff surface. A standalone stdio MCP server, depending on **BundleStore only**.

The model is **pull, never push**. Claude Code spawns this server itself as a subprocess when
a session starts. Nothing listens, nothing polls, there is no daemon, and **HiveAnnotate does
not need to be running** — the server reads the bundle folder off disk. That independence is
the feature, not an implementation convenience.

Tools:

- `list_bundles` — open Bundles, newest first.
- `get_bundle` — intent, notes, and **absolute image paths**.
- `close_bundle` — mark a Bundle handled once the work lands, so the Catalogue drains itself.

`get_bundle` returning absolute paths is the fact that eliminates drag-and-drop: an agent
reads the image files directly from disk.

## Acceptance criteria

- [ ] The server starts and answers all three tools driven against a temp bundle directory, in a plain Node process with Electron absent. **(mandatory)**
- [ ] `get_bundle` returns paths that are absolute and that exist on disk. **(mandatory)**
- [ ] `list_bundles` orders newest first and excludes closed Bundles. **(mandatory)**
- [ ] `close_bundle` is durable — it survives a server restart and is visible to the Catalogue. **(mandatory)**
- [ ] Requesting a Bundle id that does not exist returns a clean error, not a crash. **(mandatory)**
- [ ] The server works while HiveAnnotate is not running, and concurrently with it running. **(mandatory)**
- [ ] The config snippet needed to register it with Claude Code is documented in the repo.

## Blocked by

- hive-v1-01
- hive-v1-04
