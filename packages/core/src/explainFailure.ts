/**
 * What the capture bar says when a capture fails.
 *
 * Three rules govern every one of these, and they are absolute:
 *   1. The bar always appears, including on failure.
 *   2. The note the user already typed is never discarded.
 *   3. Nothing steals focus, even when failing. No modals, no notifications.
 *
 * A failed capture costs the image, never the thought.
 */

import type { CaptureFailure } from './macos/captureBackend.ts'

export interface FailureExplanation {
  title: string
  detail: string
  retryLabel: string
  /** An offer that is better than retrying the same thing. */
  alternative?: string
  /** A System Settings privacy pane worth opening. */
  settingsPane?: string
  /**
   * True when the bar must not close on its own. A capture that is not on disk
   * does not exist, and letting the bar disappear would tell the user it was
   * saved.
   */
  blocking: boolean
}

export function explainFailure(reason: CaptureFailure, detail?: string): FailureExplanation {
  switch (reason) {
    case 'no-permission':
      return {
        title: 'Not captured',
        detail:
          'Screen Recording is off. macOS would hand back your wallpaper with every window stripped out, so nothing was taken.',
        retryLabel: 'keeps this note and retries the shot',
        settingsPane: 'ScreenCapture',
        blocking: false,
      }

    case 'stale-window-id':
      return {
        title: 'Window gone',
        detail: 'That window closed between the hotkey and the capture.',
        retryLabel: 'retry',
        alternative: 'take the whole screen instead',
        blocking: false,
      }

    case 'write-failure':
      return {
        title: 'Not saved',
        detail:
          detail && detail.trim()
            ? `The image was taken but could not be written to disk — ${detail.trim()}`
            : 'The image was taken but could not be written to disk. It is still in memory until you dismiss this.',
        retryLabel: 'retry the write',
        blocking: true,
      }

    case 'unknown':
      return {
        title: 'Capture failed',
        detail:
          detail && detail.trim()
            ? `screencapture reported: ${detail.trim()}`
            : 'screencapture failed without saying why.',
        retryLabel: 'retry',
        blocking: false,
      }
  }
}
