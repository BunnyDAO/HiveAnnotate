/**
 * The chords, in one place.
 *
 * Window and region capture are **co-primary**: the locked intent is "any part
 * of the desktop", so neither is a fallback and neither gets the worse chord.
 */

import type { CaptureTarget } from './macos/captureBackend.ts'

export type CaptureIntent = CaptureTarget['kind']

export interface Chord {
  intent: CaptureIntent
  /** Electron accelerator syntax. */
  accelerator: string
  label: string
}

export const DEFAULT_CHORDS: readonly Chord[] = [
  { intent: 'window', accelerator: 'Alt+1', label: 'Capture the focused window' },
  { intent: 'screen', accelerator: 'Alt+2', label: 'Capture the whole screen' },
  { intent: 'region', accelerator: 'Alt+3', label: 'Pick a region with the keyboard' },
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
  onIntent: (intent: CaptureIntent) => void,
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
