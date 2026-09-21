import { describe, it, expect } from 'vitest'
import { formatAccelerator } from './formatAccelerator.ts'

describe('showing a shortcut the way a Mac user reads it', () => {
  it.each([
    ['Alt+1', '⌥1'],
    ['Option+1', '⌥1'],
    ['Shift+Enter', '⇧↩'],
    ['CommandOrControl+Shift+S', '⇧⌘S'],
    ['Control+Alt+Space', '⌃⌥Space'],
    ['Cmd+Escape', '⌘⎋'],
    ['Alt+q', '⌥Q'],
  ])('%s → %s', (accelerator, expected) => {
    expect(formatAccelerator(accelerator)).toBe(expected)
  })

  // macOS menus always order modifiers Control, Option, Shift, Command —
  // whatever order the accelerator was written in.
  it('puts modifiers in the standard macOS order', () => {
    expect(formatAccelerator('Shift+Alt+Control+1')).toBe('⌃⌥⇧1')
  })

  it('never shows the word Alt, which is not what the key says on a Mac', () => {
    expect(formatAccelerator('Alt+4')).not.toMatch(/alt/i)
  })
})
