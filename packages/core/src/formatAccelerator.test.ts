import { describe, it, expect } from 'vitest'
import { formatAccelerator } from './formatAccelerator.ts'

describe('showing a shortcut the way a Mac user says it', () => {
  it.each([
    ['Alt+1', 'Option + 1'],
    ['Option+1', 'Option + 1'],
    ['Shift+Enter', 'Shift + Enter'],
    ['CommandOrControl+Shift+S', 'Shift + Cmd + S'],
    ['Control+Alt+Space', 'Control + Option + Space'],
    ['Cmd+Escape', 'Cmd + Esc'],
    ['Alt+q', 'Option + Q'],
  ])('%s → %s', (accelerator, expected) => {
    expect(formatAccelerator(accelerator)).toBe(expected)
  })

  it('lists modifiers in the order macOS always uses', () => {
    expect(formatAccelerator('Shift+Alt+Control+1')).toBe('Control + Option + Shift + 1')
  })

  it('never shows the word Alt, which is not what the key says on a Mac', () => {
    expect(formatAccelerator('Alt+4')).not.toMatch(/alt/i)
  })

  // The user found the macOS glyphs unclear; words are the whole point.
  it('never falls back to a symbol glyph', () => {
    for (const a of ['Alt+1', 'Shift+Enter', 'Cmd+Escape', 'Control+Tab', 'Backspace']) {
      expect(formatAccelerator(a)).not.toMatch(/[⌃⌥⇧⌘↩⎋⇥⌫␣]/)
    }
  })
})
