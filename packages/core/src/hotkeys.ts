/**
 * The chords, in one place.
 *
 * The region picker has the easiest chord. It started on ⌥3, but in real use
 * it was the one reached for most — windows tend to be maximised, which makes
 * a window capture nearly a full-screen one, so picking the part you mean is
 * what you actually want. Changed on the user's request after first use.
 *
 * The number row is used deliberately: ⌥-digit produces rarely-typed symbols
 * (¡ ™ £ ¢), whereas ⌥-letter produces characters people do type, and a
 * global chord swallows them everywhere.
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

export const DEFAULT_CHORDS: readonly Chord[] = [
  { intent: 'region', accelerator: 'Alt+1', label: 'Pick a region with the keyboard' },
  { intent: 'screen', accelerator: 'Alt+2', label: 'Capture the whole screen' },
  { intent: 'window', accelerator: 'Alt+3', label: 'Capture the focused window' },
  { intent: 'catalogue', accelerator: 'Alt+4', label: 'Open or close the Catalogue' },
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
