import { describe, it, expect, vi } from 'vitest'
import {
  APPLE_AREA_SCREENSHOT,
  DEFAULT_CHORDS,
  MACOS_RESERVED_SCREENSHOT_DIGITS,
  registerChords,
  unavailableChords,
} from './hotkeys.ts'
import type { ChordAction } from './hotkeys.ts'

const accel = (intent: ChordAction) => DEFAULT_CHORDS.find((c) => c.intent === intent)?.accelerator

describe('the chord table', () => {
  it('covers region, window and the Catalogue', () => {
    expect(DEFAULT_CHORDS.map((c) => c.intent).sort()).toEqual(['catalogue', 'region', 'window'])
  })

  it('gives every chord a distinct accelerator', () => {
    const accelerators = DEFAULT_CHORDS.map((c) => c.accelerator)
    expect(new Set(accelerators).size).toBe(accelerators.length)
  })

  it('puts the region picker on the easiest chord', () => {
    expect(accel('region')).toBe('CommandOrControl+Shift+1')
  })

  it('has a chord that opens the Catalogue', () => {
    expect(accel('catalogue')).toBe('CommandOrControl+Shift+0')
  })

  // Cmd on a Mac, Ctrl on Windows — one table, the platform's own convention.
  it('uses Cmd/Ctrl + Shift + a digit for every chord', () => {
    for (const { accelerator } of DEFAULT_CHORDS) {
      expect(accelerator).toMatch(/^CommandOrControl\+Shift\+\d$/)
    }
  })

  // Cmd + digit alone switches tabs in iTerm2, Chrome, Safari and Slack.
  it('never takes a bare Cmd + digit', () => {
    for (const { accelerator } of DEFAULT_CHORDS) expect(accelerator).toContain('Shift')
  })

  it("stays off the digits macOS keeps for its own screenshots", () => {
    for (const { accelerator } of DEFAULT_CHORDS) {
      const digit = accelerator.at(-1)!
      expect(MACOS_RESERVED_SCREENSHOT_DIGITS).not.toContain(digit)
    }
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

    expect(fired).toEqual(['region', 'window', 'catalogue'])
  })

  it('reports a chord another app already owns instead of failing silently', () => {
    const results = registerChords(DEFAULT_CHORDS, (a) => a !== 'CommandOrControl+Shift+2', vi.fn())
    expect(unavailableChords(results).map((r) => r.chord.intent)).toEqual(['window'])
  })

  it('still registers the chords that are available when one is taken', () => {
    const results = registerChords(DEFAULT_CHORDS, (a) => a !== 'CommandOrControl+Shift+2', vi.fn())
    expect(results.filter((r) => r.registered)).toHaveLength(2)
  })

  it('reports nothing unavailable when all register', () => {
    expect(unavailableChords(registerChords(DEFAULT_CHORDS, () => true, vi.fn()))).toEqual([])
  })
})

describe("taking over Apple's Cmd + Shift + 4", () => {
  it('is the Mac area-screenshot shortcut, symbolic hotkey 30', () => {
    expect(APPLE_AREA_SCREENSHOT).toEqual({ id: 30, accelerator: 'CommandOrControl+Shift+4' })
  })

  // It is only ever claimed when the user has switched Apple's off, so it must
  // not be one of the chords registered unconditionally at start-up.
  it('is not among the chords registered unconditionally', () => {
    expect(DEFAULT_CHORDS.map((c) => c.accelerator)).not.toContain(APPLE_AREA_SCREENSHOT.accelerator)
  })
})
