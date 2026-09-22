import { describe, it, expect } from 'vitest'
import { formatAccelerator, primaryModifierName } from './formatAccelerator.ts'

describe('shortcuts on a Mac', () => {
  it.each([
    ['CommandOrControl+Shift+1', 'Cmd + Shift + 1'],
    ['Alt+1', 'Option + 1'],
    ['Shift+Enter', 'Shift + Enter'],
    ['Cmd+Escape', 'Cmd + Esc'],
    ['Control+Alt+Space', 'Control + Option + Space'],
  ])('%s → %s', (accelerator, expected) => {
    expect(formatAccelerator(accelerator, 'darwin')).toBe(expected)
  })

  it('puts Cmd first, the way shortcuts are said', () => {
    expect(formatAccelerator('Shift+CommandOrControl+4', 'darwin')).toBe('Cmd + Shift + 4')
    expect(formatAccelerator('Shift+Alt+Control+1', 'darwin')).toBe('Control + Option + Shift + 1')
  })

  it('never says Alt on a Mac', () => {
    expect(formatAccelerator('Alt+4', 'darwin')).not.toMatch(/\balt\b/i)
  })
})

describe('shortcuts on Windows', () => {
  it.each([
    ['CommandOrControl+Shift+1', 'Ctrl + Shift + 1'],
    ['Alt+1', 'Alt + 1'],
    ['Super+E', 'Win + E'],
  ])('%s → %s', (accelerator, expected) => {
    expect(formatAccelerator(accelerator, 'win32')).toBe(expected)
  })

  it('never says Cmd or Option on Windows', () => {
    for (const a of ['CommandOrControl+Shift+1', 'Alt+2']) {
      expect(formatAccelerator(a, 'win32')).not.toMatch(/Cmd|Option/)
    }
  })
})

describe('the everyday command key', () => {
  it('is Cmd on a Mac and Ctrl elsewhere', () => {
    expect(primaryModifierName('darwin')).toBe('Cmd')
    expect(primaryModifierName('win32')).toBe('Ctrl')
    expect(primaryModifierName('linux')).toBe('Ctrl')
  })
})

describe('in words, never glyphs', () => {
  it('never produces a symbol', () => {
    for (const a of ['Alt+1', 'Shift+Enter', 'Cmd+Escape', 'Control+Tab', 'Backspace', 'CommandOrControl+Shift+0']) {
      for (const p of ['darwin', 'win32']) expect(formatAccelerator(a, p)).not.toMatch(/[⌃⌥⇧⌘↩⎋⇥⌫␣]/)
    }
  })
})
