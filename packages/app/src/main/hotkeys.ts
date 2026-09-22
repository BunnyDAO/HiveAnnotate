import { globalShortcut } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  APPLE_AREA_SCREENSHOT,
  DEFAULT_CHORDS,
  SecureInputWatcher,
  registerChords,
  unavailableChords,
} from '@hiveannotate/core'
import type { ChordAction, ChordRegistration, SecureInputState } from '@hiveannotate/core'
import { helperPath } from './helper.ts'

const run = promisify(execFile)

export interface HotkeyService {
  registrations: ChordRegistration[]
  unavailable: ChordRegistration[]
  onSecureInputChange: (listener: (state: SecureInputState) => void) => () => void
  /**
   * Takes Cmd + Shift + 4 for the region picker, or gives it back. Returns
   * whether HiveAnnotate now holds it.
   */
  claimAppleAreaShortcut: (on: boolean) => boolean
  dispose: () => void
}

/**
 * Wires the chords to Electron and watches Secure Input.
 *
 * Everything that decides anything lives in core; this supplies the platform
 * calls. The spike (hive-v1-02) established that ordinary modifier chords
 * register with no Accessibility prompt.
 */
export function startHotkeys(onIntent: (intent: ChordAction) => void): HotkeyService {
  const registrations = registerChords(
    DEFAULT_CHORDS,
    (accelerator, handler) => globalShortcut.register(accelerator, handler) ?? false,
    onIntent,
  )

  const watcher = new SecureInputWatcher({
    probe: async () => {
      const { stdout } = await run(helperPath(), ['secure-input'])
      const parsed = JSON.parse(stdout) as { secureInput: boolean; app?: string }
      return {
        enabled: parsed.secureInput,
        ...(parsed.app ? { holder: parsed.app } : {}),
      }
    },
  })
  watcher.start()

  let appleClaimed = false
  const claimAppleAreaShortcut = (on: boolean): boolean => {
    if (on && !appleClaimed) {
      appleClaimed = globalShortcut.register(APPLE_AREA_SCREENSHOT.accelerator, () => onIntent('region')) ?? false
    } else if (!on && appleClaimed) {
      globalShortcut.unregister(APPLE_AREA_SCREENSHOT.accelerator)
      appleClaimed = false
    }
    return appleClaimed
  }

  return {
    claimAppleAreaShortcut,
    registrations,
    unavailable: unavailableChords(registrations),
    onSecureInputChange: (listener) => watcher.onChange(listener),
    dispose: () => {
      watcher.stop()
      for (const { chord } of registrations) globalShortcut.unregister(chord.accelerator)
      claimAppleAreaShortcut(false)
    },
  }
}
