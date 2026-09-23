import { describe, it, expect } from 'vitest'
import { quickPrompt } from './quickPrompt.ts'

const png = '/Users/you/HiveAnnotate/scratch/2026-09-23-1412-sidebar.png'

describe('quickPrompt — the line pasted into an agent when nothing is saved', () => {
  it('carries the note and the path to the screenshot', () => {
    const line = quickPrompt('the sidebar collapses when the modal opens', png)
    expect(line).toContain('the sidebar collapses when the modal opens')
    expect(line).toContain(png)
  })

  // Terminals send a newline as Enter, which would fire a half-written prompt.
  it('is a single line, whatever the note contains', () => {
    expect(quickPrompt('first line\nsecond line\n\nthird', png)).not.toContain('\n')
  })

  it('still says something useful when no note was typed', () => {
    const line = quickPrompt('   ', png)
    expect(line).toContain(png)
    expect(line.toLowerCase()).toContain('screenshot')
  })

  it('reads as one sentence when the note already ends in punctuation', () => {
    expect(quickPrompt('why is this blank?', png)).not.toContain('?.')
    expect(quickPrompt('fix this.', png)).not.toContain('..')
  })
})
