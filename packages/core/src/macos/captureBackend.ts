/**
 * Taking the picture.
 *
 * Shells out to `screencapture` rather than using Electron's desktopCapturer:
 * it is faster and gives true Retina resolution. The interface is
 * implementation-agnostic so a Windows backend, or a future ScreenCaptureKit
 * rewrite, is a port rather than a rewrite — no screencapture detail crosses it.
 *
 * Captures land in an app-owned scratch directory and are returned as bytes.
 * They never touch the Desktop, and Preview is never opened.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { pngSize } from '../pngSize.ts'

const run = promisify(execFile)

export type CaptureTarget =
  | { kind: 'window'; windowId: number }
  | { kind: 'screen' }
  | { kind: 'region'; x: number; y: number; width: number; height: number }

export type CaptureFailure =
  | 'no-permission'
  | 'stale-window-id'
  | 'write-failure'
  | 'unknown'

export type CaptureResult =
  | { ok: true; image: Uint8Array; width: number; height: number; kind: CaptureTarget['kind'] }
  | { ok: false; reason: CaptureFailure; detail?: string }

export interface CaptureBackend {
  capture(target: CaptureTarget): Promise<CaptureResult>
}

export interface MacCaptureBackendOptions {
  screencapturePath: string
  /** Queries the Screen Recording grant. Must not prompt. */
  isPermitted: () => Promise<boolean>
  scratchDir: string
}

export class MacCaptureBackend implements CaptureBackend {
  private readonly options: MacCaptureBackendOptions

  constructor(options: MacCaptureBackendOptions) {
    this.options = options
  }

  async capture(target: CaptureTarget): Promise<CaptureResult> {
    // Checked before invoking, so the app can explain the problem rather than
    // showing a failed capture. For full-screen capture this is the only guard
    // that works at all: without the grant it succeeds and returns the desktop
    // picture with the windows stripped out.
    if (!(await this.options.isPermitted())) return { ok: false, reason: 'no-permission' }

    const file = join(this.options.scratchDir, `${randomUUID()}.png`)

    try {
      await mkdir(this.options.scratchDir, { recursive: true })
    } catch (error) {
      return { ok: false, reason: 'write-failure', detail: (error as Error).message }
    }

    try {
      await run(this.options.screencapturePath, [...flagsFor(target), file])
    } catch (error) {
      return classifyFailure(error)
    }

    let image: Uint8Array
    try {
      image = await readFile(file)
    } catch {
      // Exit status said success but nothing landed. Reporting success here
      // would mean the user believes a capture was saved when it was not.
      return { ok: false, reason: 'write-failure', detail: 'no file was produced' }
    } finally {
      await rm(file, { force: true })
    }

    const size = pngSize(image)
    if (!size) return { ok: false, reason: 'unknown', detail: 'not a readable PNG' }

    return { ok: true, image, width: size.width, height: size.height, kind: target.kind }
  }
}

function flagsFor(target: CaptureTarget): string[] {
  // -x silences the shutter; -o drops the window shadow so the image is the
  // window and not a drop shadow on someone else's desktop.
  switch (target.kind) {
    case 'window':
      return ['-x', '-o', '-l', String(target.windowId)]
    case 'region':
      return ['-x', '-R', `${target.x},${target.y},${target.width},${target.height}`]
    case 'screen':
      return ['-x']
  }
}

function classifyFailure(error: unknown): CaptureResult {
  const stderr = String((error as { stderr?: string }).stderr ?? (error as Error).message ?? '')

  // Measured on macOS 26.3: window and region capture fail loudly when the
  // target is gone or the grant is missing. See
  // docs/research/macos-capture-constraints.md.
  if (/could not create image from (window|rect)/i.test(stderr)) {
    return { ok: false, reason: 'stale-window-id', detail: stderr.trim() }
  }

  return { ok: false, reason: 'unknown', detail: stderr.trim() }
}
