/**
 * Finds the frontmost window to aim `screencapture -l` at.
 *
 * Wraps the native helper (packages/app/native/hive-helper.m), which reads
 * CGWindowListCopyWindowInfo cross-referenced with NSWorkspace's frontmost
 * application. Crucially that needs **no Screen Recording permission** — only
 * the window *title* is gated, and we never ask for the title. So window
 * targeting works before the user has granted anything.
 *
 * Every failure is a result, never an exception: this sits directly under a
 * hotkey, and an unhandled throw here would mean a capture that silently does
 * nothing.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export interface FrontmostWindow {
  windowId: number
  pid: number
  app: string
  /** Quartz global display coordinates, origin top-left of the main display — the space `-R` expects. */
  x: number
  y: number
  width: number
  height: number
}

export type LocateResult =
  | { ok: true; window: FrontmostWindow }
  | { ok: false; reason: string }

interface HelperWindow {
  windowId: number
  x: number
  y: number
  width: number
  height: number
}

interface HelperOk {
  ok: true
  pid: number
  app: string
  /** The app's ordinary windows, front to back. */
  windows: HelperWindow[]
}

/**
 * Below this in either dimension a window is a status bubble, a tooltip or a
 * find bar rather than the thing the user is looking at. Observed in the wild:
 * Chrome's link-preview strip is 1772x22 and sits in front of the real window,
 * so area alone is not enough to tell them apart.
 */
const MIN_WIDTH = 160
const MIN_HEIGHT = 120

function chooseWindow(windows: HelperWindow[]): HelperWindow | null {
  const usable = windows.filter((w) => w.width > 0 && w.height > 0)
  if (usable.length === 0) return null

  // Front to back, so the first window that looks like a real one wins.
  const substantial = usable.find((w) => w.width >= MIN_WIDTH && w.height >= MIN_HEIGHT)
  if (substantial) return substantial

  // Everything is small: the app may genuinely only have a small utility
  // window. Returning the biggest beats returning nothing.
  return usable.reduce((a, b) => (a.width * a.height >= b.width * b.height ? a : b))
}
interface HelperFail {
  ok: false
  reason?: string
}

export class WindowLocator {
  private readonly helperPath: string
  private readonly excludePid: number | undefined

  constructor(helperPath: string, options: { excludePid?: number } = {}) {
    this.helperPath = helperPath
    this.excludePid = options.excludePid
  }

  async frontmost(): Promise<LocateResult> {
    const args = ['frontmost']
    if (this.excludePid !== undefined) args.push('--exclude-pid', String(this.excludePid))

    let stdout: string
    try {
      ;({ stdout } = await run(this.helperPath, args))
    } catch (error) {
      return { ok: false, reason: `helper failed: ${(error as Error).message}` }
    }

    let parsed: HelperOk | HelperFail
    try {
      parsed = JSON.parse(stdout) as HelperOk | HelperFail
    } catch {
      return { ok: false, reason: `unreadable helper output: ${stdout.trim().slice(0, 80)}` }
    }

    if (!parsed.ok) return { ok: false, reason: parsed.reason ?? 'unknown' }

    const chosen = chooseWindow(parsed.windows ?? [])
    // A zero-area window is not something screencapture can photograph, and
    // handing one on would surface later as a mystery empty capture.
    if (!chosen) return { ok: false, reason: 'no-window' }

    return {
      ok: true,
      window: {
        windowId: chosen.windowId,
        pid: parsed.pid,
        app: parsed.app,
        x: chosen.x,
        y: chosen.y,
        width: chosen.width,
        height: chosen.height,
      },
    }
  }
}
