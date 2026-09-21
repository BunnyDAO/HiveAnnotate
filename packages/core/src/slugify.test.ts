import { describe, it, expect } from 'vitest'
import { slugify } from './slugify.ts'

describe('slugify', () => {
  it('is deterministic', () => {
    expect(slugify('sidebar collapses')).toBe(slugify('sidebar collapses'))
  })

  it('lowercases and hyphenates', () => {
    expect(slugify('Sidebar Collapses When The Modal Opens')).toBe(
      'sidebar-collapses-when-the-modal-opens',
    )
  })

  it('folds accented letters to their base form', () => {
    expect(slugify('Café héader is misaligned')).toBe('cafe-header-is-misaligned')
  })

  it('drops emoji but keeps the words around them', () => {
    expect(slugify('🔥 sidebar is broken 🔥')).toBe('sidebar-is-broken')
  })

  it.each([
    ['🔥🔥🔥', 'a note that is only emoji'],
    ['   ', 'a note that is only whitespace'],
    ['', 'an empty note'],
    ['サイドバーが消える', 'a note with no latin characters at all'],
  ])('falls back to a usable name for %j (%s)', (input) => {
    const slug = slugify(input)
    expect(slug).not.toBe('')
    expect(slug).toMatch(/^[a-z0-9][a-z0-9-]*$/)
  })

  it('never emits a leading, trailing or doubled hyphen', () => {
    expect(slugify('  ---weird!!!  spacing---  ')).toBe('weird-spacing')
  })

  it('truncates long notes without leaving a trailing hyphen', () => {
    const slug = slugify('the sidebar collapses the very moment that the invite modal mounts itself')
    expect(slug.length).toBeLessThanOrEqual(60)
    expect(slug).not.toMatch(/-$/)
  })

  it('never produces a path separator or a dot segment', () => {
    for (const input of ['../../etc/passwd', 'a/b/c', '.', '..', 'C:\\Windows']) {
      const slug = slugify(input)
      expect(slug).not.toContain('/')
      expect(slug).not.toContain('\\')
      expect(slug).not.toBe('.')
      expect(slug).not.toBe('..')
    }
  })
})
