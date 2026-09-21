import { describe, it, expect, vi } from 'vitest'
import {
  DEFAULT_CHORDS,
  registerChords,
  unavailableChords,
} from './hotkeys.ts'
import type { CaptureIntent } from './hotkeys.ts'

describe('the chord table', () => {
  it('covers window, screen and region', () => {
    expect(DEFAULT_CHORDS.map((c) => c.intent).sort()).toEqual(['region', 'screen', 'window'])
  })

  it('gives every chord a distinct accelerator', () => {
    const accelerators = DEFAULT_CHORDS.map((c) => c.accelerator)
    expect(new Set(accelerators).size).toBe(accelerators.length)
  })

  // Region and window are co-primary — the locked intent is "any part of the
  // desktop" — so neither may be given a worse chord than the other.
  it('gives region and window equally reachable chords', () => {
    const shapeOf = (a: string) => a.replace(/\d+$/, 'N')
    const window = DEFAULT_CHORDS.find((c) => c.intent === 'window')!
    const region = DEFAULT_CHORDS.find((c) => c.intent === 'region')!
    expect(shapeOf(region.accelerator)).toBe(shapeOf(window.accelerator))
  })
})

describe('registering chords', () => {
  it('fires the right intent for each chord', () => {
    const handlers = new Map<string, () => void>()
    const fired: CaptureIntent[] = []

    registerChords(
      DEFAULT_CHORDS,
      (accelerator, handler) => {
        handlers.set(accelerator, handler)
        return true
      },
      (intent) => fired.push(intent),
    )

    for (const chord of DEFAULT_CHORDS) handlers.get(chord.accelerator)!()

    expect(fired).toEqual(['window', 'screen', 'region'])
  })

  it('reports a chord another app already owns instead of failing silently', () => {
    const results = registerChords(
      DEFAULT_CHORDS,
      (accelerator) => accelerator !== 'Alt+2',
      vi.fn(),
    )

    expect(unavailableChords(results).map((r) => r.chord.intent)).toEqual(['screen'])
  })

  it('still registers the chords that are available when one is taken', () => {
    const results = registerChords(DEFAULT_CHORDS, (a) => a !== 'Alt+2', vi.fn())
    expect(results.filter((r) => r.registered)).toHaveLength(2)
  })

  it('reports nothing unavailable when all register', () => {
    const results = registerChords(DEFAULT_CHORDS, () => true, vi.fn())
    expect(unavailableChords(results)).toEqual([])
  })
})
