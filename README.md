<div align="center">

<img src="docs/assets/hiveannotate-mark.svg" width="96" height="96" alt="HiveAnnotate">

# HiveAnnotate

**Screenshot any part of your screen without touching the mouse, say what's wrong while it's still on your mind, and hand the lot to your AI.**

A free macOS menu-bar app from the makers of [HiveOp](https://hiveop.io).

[Download](#install) · [How it works](#how-it-works) · [Give a bundle to your AI](#give-a-bundle-to-your-ai) · [HiveOp](https://app.hiveop.io)

</div>

---

## The problem

You hit a bug. You screenshot it. The file lands on the Desktop. You find it, drag it into a
chat, and only then type what you actually wanted done — by which point you have three
screenshots called `Screenshot 2026-09-21 at 14.03.11` and no idea which was which.

HiveAnnotate closes that gap. The note is typed at the moment of the capture, while you still
know what you meant, and screenshots that belong to one problem stay together.

## How it works

Press a shortcut. A bar appears with the screenshot ready and the cursor already in the note
field. Type a line, press Enter, and you're back in what you were doing. Nothing takes focus
away from the app you're debugging.

| Shortcut | What it does |
|---|---|
| **Cmd + Shift + 1** | Pick part of the screen with the keyboard. Press Enter straight away for the whole screen. |
| **Cmd + Shift + 2** | Capture the window you're in. |
| **Cmd + Shift + 0** | Open the Catalogue. |

Inside the picker, the screen is split into nine cells: press a letter (Q W E / A S D / Z X C)
to narrow down, press it again to unselect, Enter to capture, Escape to cancel. No dragging, no
aiming. The app can also take over **Cmd + Shift + 4** from Apple's own screenshot tool if you
want the shortcut you already know.

After the shutter, a blue outline flashes around exactly what was taken, so you can see it
caught the right thing.

### Bundles

One problem is usually several screenshots: the broken state, the console, what it should look
like. Those go into one **bundle**, with one instruction covering all of them. The first note
names the bundle; later captures join the one you're working in, and you can file a capture
elsewhere from the bar.

Bundles live in plain folders under `~/HiveAnnotate/bundles/`:

```
2026-09-21-sidebar-collapses/
├── manifest.json
├── 001.png
├── 002.png
└── bundle.md      ← the whole problem, readable by anything
```

No database, no lock-in. If HiveAnnotate vanished tomorrow, your screenshots and notes are
still sitting there in readable form.

### The Catalogue

Cmd + Shift + 0 opens it: browse bundles, fix a note, move a screenshot into another bundle,
view a screenshot full size, mark a bundle handled (or reopen it), delete one you're done with.
Deleted bundles go to the Trash, not into thin air.

## Give a bundle to your AI

**Copy prompt** puts one line on your clipboard that any file-reading AI understands:

```
Take a look at HiveAnnotate bundle 2026-09-21-sidebar-collapses: screenshots of a problem,
with my notes on what needs doing. Read ~/HiveAnnotate/bundles/2026-09-21-sidebar-collapses/bundle.md
first. It describes each screenshot, and the image files are in the same folder.
```

Paste it into Claude Code, Codex, Cursor — anything that can read files on your Mac. The app
has no favourite AI and never makes an AI call itself.

There's also an **MCP server** for agents that prefer to ask: `list_bundles`, `get_bundle`,
`close_bundle`. It runs as its own process, reads the folders off disk, and doesn't need
HiveAnnotate to be running. See [`packages/mcp`](packages/mcp).

## Install

> **Not released yet.** The signed download and the Homebrew cask are on the way. For now,
> build it yourself — you need macOS on Apple Silicon, Node 22 or newer, and Xcode command
> line tools.

```bash
git clone https://github.com/BunnyDAO/HiveAnnotate.git
cd HiveAnnotate
npm install
npm run pack        # builds packages/app/release/mac-arm64/HiveAnnotate.app
```

Then open the app from that folder and grant **Screen Recording** when macOS asks
(System Settings → Privacy & Security → Screen Recording). Without it, macOS hands back a
picture of your wallpaper with every window stripped out, so the app checks the permission
before each capture and tells you rather than saving something useless.

Signing the build keeps that permission across rebuilds — it takes one command and no Apple
account. See [`docs/signing.md`](docs/signing.md).

## Privacy

Everything stays on your Mac. The app has no account, no telemetry, no server. It never sends
a screenshot anywhere — the only thing that leaves is what *you* paste into your own AI.

## Development

```bash
npm run dev          # run from source
npm test             # 290+ tests
npm run typecheck
```

The core (capture flow, bundles, storage, hand-off) is plain Node with no Electron anywhere
near it — enforced by a test, because the MCP server runs standalone. Design notes are in
[`docs/prd`](docs/prd) and [`docs/adr`](docs/adr).

---

<div align="center">

<a href="https://hiveop.io"><img src="docs/assets/hiveop-logo.svg" width="44" height="44" alt="HiveOp"></a>

**Made by [HiveOp](https://hiveop.io)** — the visual AI agent workspace where you watch agents
work: every agent flies as a mothership, drones swarm the exact files it reads and edits, and
you pair-program with the swarm in real time.

**[Try HiveOp →](https://app.hiveop.io)**

</div>
