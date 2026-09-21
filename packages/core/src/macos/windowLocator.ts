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

interface HelperOk extends FrontmostWindow {
  ok: true
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

    const { windowId, pid, app, x, y, width, height } = parsed
    // A zero-area window is not something screencapture can photograph, and
    // handing it on would surface as a mystery empty capture.
    if (!(width > 0 && height > 0)) {
      return { ok: false, reason: `window ${windowId} has no area (${width}x${height})` }
    }

    return { ok: true, window: { windowId, pid, app, x, y, width, height } }
  }
}
