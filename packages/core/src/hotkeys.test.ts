import { describe, it, expect, vi } from 'vitest'
import { DEFAULT_CHORDS, registerChords, unavailableChords } from './hotkeys.ts'
import type { ChordAction } from './hotkeys.ts'

const accel = (intent: ChordAction) => DEFAULT_CHORDS.find((c) => c.intent === intent)?.accelerator

describe('the chord table', () => {
  it('covers region, screen, window and the Catalogue', () => {
    expect(DEFAULT_CHORDS.map((c) => c.intent).sort()).toEqual([
      'catalogue',
      'region',
      'screen',
      'window',
    ])
  })

  it('gives every chord a distinct accelerator', () => {
    const accelerators = DEFAULT_CHORDS.map((c) => c.accelerator)
    expect(new Set(accelerators).size).toBe(accelerators.length)
  })

  // The user reached for the region picker most in real use, so it has the
  // easiest chord.
  it('puts the region picker on the easiest chord', () => {
    expect(accel('region')).toBe('Alt+1')
  })

  it('has a chord that opens the Catalogue', () => {
    expect(accel('catalogue')).toBe('Alt+4')
  })

  // ⌥-letter produces characters people type (ç, œ, ß); a global chord would
  // swallow them in every app. ⌥-digit produces rarely-typed symbols.
  it('uses only Option plus a digit, never Option plus a letter', () => {
    for (const { accelerator } of DEFAULT_CHORDS) expect(accelerator).toMatch(/^Alt\+\d$/)
  })
})

describe('registering chords', () => {
  it('fires the right action for each chord', () => {
    const handlers = new Map<string, () => void>()
    const fired: ChordAction[] = []

    registerChords(
      DEFAULT_CHORDS,
      (accelerator, handler) => {
        handlers.set(accelerator, handler)
        return true
      },
      (intent) => fired.push(intent),
    )

    for (const chord of DEFAULT_CHORDS) handlers.get(chord.accelerator)!()

    expect(fired).toEqual(['region', 'screen', 'window', 'catalogue'])
  })

  it('reports a chord another app already owns instead of failing silently', () => {
    const results = registerChords(DEFAULT_CHORDS, (a) => a !== 'Alt+2', vi.fn())
    expect(unavailableChords(results).map((r) => r.chord.intent)).toEqual(['screen'])
  })

  it('still registers the chords that are available when one is taken', () => {
    const results = registerChords(DEFAULT_CHORDS, (a) => a !== 'Alt+2', vi.fn())
    expect(results.filter((r) => r.registered)).toHaveLength(3)
  })

  it('reports nothing unavailable when all register', () => {
    expect(unavailableChords(registerChords(DEFAULT_CHORDS, () => true, vi.fn()))).toEqual([])
  })
})
