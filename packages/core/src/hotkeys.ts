/**
 * The chords, in one place.
 *
 * `CommandOrControl` resolves to Cmd on macOS and Ctrl on Windows and Linux,
 * so each platform gets its own convention without a second table.
 *
 * Why Cmd/Ctrl + Shift + a digit:
 * - Cmd + digit alone is taken by nearly every Mac app (tab switching in
 *   iTerm2, Chrome, Safari, Slack); a global one would break "go to tab 1"
 *   everywhere.
 * - Cmd + Shift + digit is where Mac screenshots live. macOS reserves 3, 4, 5
 *   and 6 for its own, so 1, 2 and 0 are used here.
 * - Option + digit (the first choice) read as odd to a Mac user, and on some
 *   layouts (German, Polish) it types characters like @ that people need.
 *
 * There is no whole-screen chord: the region picker opens with the whole
 * screen selected, so its chord then Enter is a full-screen capture.
 */

import type { CaptureTarget } from './macos/captureBackend.ts'

export type CaptureIntent = CaptureTarget['kind']

/** Everything a global chord can do: take a capture, or open the Catalogue. */
export type ChordAction = CaptureIntent | 'catalogue'

export interface Chord {
  intent: ChordAction
  /** Electron accelerator syntax. */
  accelerator: string
  label: string
}

/** Digits macOS keeps for its own screenshot shortcuts (with Cmd + Shift). */
export const MACOS_RESERVED_SCREENSHOT_DIGITS = ['3', '4', '5', '6'] as const

/**
 * Apple's own "save picture of selected area" — the Mac screenshot shortcut
 * people already have in their fingers. HiveAnnotate cannot take it while
 * macOS has it switched on; once the user switches Apple's off in System
 * Settings, the region picker claims it. `id` is its macOS symbolic-hotkey id.
 */
export const APPLE_AREA_SCREENSHOT = {
  id: 30,
  accelerator: 'CommandOrControl+Shift+4',
} as const

export const DEFAULT_CHORDS: readonly Chord[] = [
  {
    intent: 'region',
    accelerator: 'CommandOrControl+Shift+1',
    label: 'Pick a region (Enter right away for the whole screen)',
  },
  { intent: 'window', accelerator: 'CommandOrControl+Shift+2', label: 'Capture the window you are in' },
  { intent: 'catalogue', accelerator: 'CommandOrControl+Shift+0', label: 'Open the Catalogue' },
] as const

export interface ChordRegistration {
  chord: Chord
  registered: boolean
}

/**
 * Registers the chords and reports which ones the OS refused.
 *
 * `globalShortcut.register` returns false when another app already owns the
 * chord. Ignoring that is how you get a hotkey that silently does nothing
 * forever, which is indistinguishable from the app being broken.
 */
export function registerChords(
  chords: readonly Chord[],
  register: (accelerator: string, handler: () => void) => boolean,
  onIntent: (intent: ChordAction) => void,
): ChordRegistration[] {
  return chords.map((chord) => ({
    chord,
    registered: register(chord.accelerator, () => onIntent(chord.intent)),
  }))
}

/** The chords the OS refused, for the UI to surface. */
export function unavailableChords(results: ChordRegistration[]): ChordRegistration[] {
  return results.filter((r) => !r.registered)
}
