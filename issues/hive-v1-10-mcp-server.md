---
id: hive-v1-10
title: McpServer — standalone stdio server that runs with Electron absent
type: AFK
status: done
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

- [x] The server starts and answers all three tools driven against a temp bundle directory, in a plain Node process with Electron absent. **(mandatory)**
- [x] `get_bundle` returns paths that are absolute and that exist on disk. **(mandatory)**
- [x] `list_bundles` orders newest first and excludes closed Bundles. **(mandatory)**
- [x] `close_bundle` is durable — it survives a server restart and is visible to the Catalogue. **(mandatory)**
- [x] Requesting a Bundle id that does not exist returns a clean error, not a crash. **(mandatory)**
- [x] The server works while HiveAnnotate is not running, and concurrently with it running. **(mandatory)**
- [x] The config snippet needed to register it with Claude Code is documented in the repo.

## Notes

- Tested by spawning the real server as a bare Node subprocess and speaking MCP over stdio.
  Running it in-process would prove nothing — the entire value of this package is that it
  works with Electron absent and HiveAnnotate not running.
- Every test runs the subprocess from a **foreign working directory**, because an MCP client
  spawns its servers from wherever it happens to be, not from this repo.
- `list_bundles` hides closed bundles but still surfaces **damaged** ones. Silently dropping a
  bundle whose manifest failed to parse would look exactly like the user's captures vanished.
- An unknown bundle id comes back as a tool error and the server stays usable; asserted by
  making a second successful call afterwards.
- `packages/mcp` is covered by the same Electron-import guard as `packages/core`.

## Blocked by

- hive-v1-01
- hive-v1-04
