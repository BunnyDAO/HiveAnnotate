# @hiveannotate/mcp

The handoff surface. A stdio MCP server that hands Bundles to any agent that asks.

**Pull, never push.** Your MCP client spawns this process itself when a session starts.
Nothing listens, nothing polls, there is no daemon — and **HiveAnnotate does not need to be
running**, because the server reads the bundle folder off disk. That independence is the
feature, not an implementation convenience.

## Tools

| Tool | What it does |
|---|---|
| `list_bundles` | Open bundles, newest first. Closed ones are done and would be noise. |
| `get_bundle` | A bundle's intent, its captures and notes, with **absolute paths** to the images. |
| `close_bundle` | Mark a bundle handled once the work has landed, so the catalogue drains itself. |

`get_bundle` returning absolute paths is what removes drag-and-drop: the agent reads the image
files straight from disk.

## Registering it with Claude Code

```bash
claude mcp add hiveannotate -- node /absolute/path/to/HiveAnnotate/packages/mcp/src/bin.ts
```

Or by hand, in `.mcp.json` or your user settings:

```json
{
  "mcpServers": {
    "hiveannotate": {
      "command": "node",
      "args": ["/absolute/path/to/HiveAnnotate/packages/mcp/src/bin.ts"]
    }
  }
}
```

Then, in a session: *"grab the latest hive bundle and fix it."*

## Where bundles are read from

`~/HiveAnnotate/bundles` by default. Set `HIVEANNOTATE_HOME` to point somewhere else — the
tests use it to run against a temp directory.

## Constraints

This package depends on `@hiveannotate/core` only, and must never import Electron. That is
enforced by `tests/electron-boundary.test.ts`, and `erasableSyntaxOnly` keeps the source to
syntax bare Node can strip.
