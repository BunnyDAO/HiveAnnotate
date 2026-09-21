import { describe, it, expect } from 'vitest'
import { filingChoices, MAX_CHOICES } from './filingChoices.ts'

const bundles = [
  { id: 'b-sidebar', intent: 'sidebar collapses' },
  { id: 'b-stripe', intent: 'stripe webhook retries' },
  { id: 'b-font', intent: 'font flashes on load' },
]

describe('the filing-into choices', () => {
  it('preselects the active bundle and offers a new one at the end', () => {
    const choices = filingChoices({ kind: 'append', bundleId: 'b-sidebar' }, bundles)

    expect(choices[0]).toMatchObject({ label: 'sidebar collapses', isDefault: true, target: { kind: 'active' } })
    expect(choices.at(-1)).toMatchObject({ isNew: true, target: { kind: 'new' }, isDefault: false })
  })

  it('does not list the active bundle twice', () => {
    const choices = filingChoices({ kind: 'append', bundleId: 'b-sidebar' }, bundles)
    expect(choices.filter((c) => c.key === 'b-sidebar')).toHaveLength(1)
  })

  it('keeps the existing bundles together, with New bundle after them', () => {
    const labels = filingChoices({ kind: 'append', bundleId: 'b-sidebar' }, bundles).map((c) => c.label)
    expect(labels).toEqual(['sidebar collapses', 'stripe webhook retries', 'font flashes on load', 'New bundle'])
  })

  it('preselects a new bundle when there is no active one, without offering it twice', () => {
    const choices = filingChoices({ kind: 'new', reason: 'no-active-bundle' }, bundles)

    expect(choices[0]).toMatchObject({ isNew: true, isDefault: true })
    expect(choices.filter((c) => c.isNew)).toHaveLength(1)
    expect(choices.slice(1).map((c) => c.target)).toEqual(
      bundles.map((b) => ({ kind: 'bundle', id: b.id })),
    )
  })

  it('always offers a new bundle, whatever else is open', () => {
    expect(filingChoices({ kind: 'new' }, []).map((c) => c.label)).toEqual(['New bundle'])
    expect(filingChoices({ kind: 'append', bundleId: 'b-font' }, bundles).some((c) => c.isNew)).toBe(true)
  })

  it('has exactly one default', () => {
    for (const d of [{ kind: 'append', bundleId: 'b-stripe' } as const, { kind: 'new' } as const]) {
      expect(filingChoices(d, bundles).filter((c) => c.isDefault)).toHaveLength(1)
    }
  })

  it('caps the list so the bar stays one row', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, intent: `bundle ${i}` }))
    expect(filingChoices({ kind: 'new' }, many)).toHaveLength(MAX_CHOICES)
    expect(filingChoices({ kind: 'append', bundleId: 'b0' }, many)).toHaveLength(MAX_CHOICES)
  })

  it('never drops New bundle when the list is capped', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ id: `b${i}`, intent: `bundle ${i}` }))
    expect(filingChoices({ kind: 'append', bundleId: 'b0' }, many).at(-1)?.isNew).toBe(true)
  })

  it('still labels the default if the active bundle is missing from the list', () => {
    const choices = filingChoices({ kind: 'append', bundleId: 'b-gone' }, bundles)
    expect(choices[0]).toMatchObject({ key: 'b-gone', label: 'b-gone', isDefault: true })
  })
})
