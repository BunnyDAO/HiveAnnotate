import { describe, it, expect } from 'vitest'
import { decideDestination, STALE_AFTER_MS } from './activeBundlePolicy.ts'
import type { ActiveBundle } from './activeBundlePolicy.ts'

const NOW = new Date('2026-09-20T14:00:00.000Z')

function activeAgo(ms: number): ActiveBundle {
  return { id: '2026-09-20-sidebar-collapses', lastCaptureAt: new Date(NOW.getTime() - ms) }
}

const MINUTE = 60_000

describe('deciding where a capture goes', () => {
  it('opens a new bundle when there is no active one', () => {
    expect(decideDestination(null, NOW)).toEqual({ kind: 'new', reason: 'no-active-bundle' })
  })

  it('appends to a bundle that was captured into moments ago', () => {
    expect(decideDestination(activeAgo(30_000), NOW)).toEqual({
      kind: 'append',
      bundleId: '2026-09-20-sidebar-collapses',
    })
  })

  it('opens a new bundle once the active one has gone stale', () => {
    expect(decideDestination(activeAgo(45 * MINUTE), NOW)).toEqual({
      kind: 'new',
      reason: 'stale',
    })
  })

  // The capture bar has to tell the user it started a new bundle rather than
  // appending, so the reason is part of the contract, not a detail.
  it('distinguishes a stale bundle from having none at all', () => {
    expect(decideDestination(activeAgo(45 * MINUTE), NOW)).not.toEqual(
      decideDestination(null, NOW),
    )
  })

  describe('the exact staleness boundary', () => {
    it('appends one millisecond before the threshold', () => {
      expect(decideDestination(activeAgo(STALE_AFTER_MS - 1), NOW).kind).toBe('append')
    })

    // Pinned deliberately: "20 minutes" is ambiguous at the instant itself, and
    // an unspecified boundary is where an off-by-one silently mis-files work.
    it('opens a new bundle exactly at the threshold', () => {
      expect(decideDestination(activeAgo(STALE_AFTER_MS), NOW).kind).toBe('new')
    })

    it('opens a new bundle one millisecond past the threshold', () => {
      expect(decideDestination(activeAgo(STALE_AFTER_MS + 1), NOW).kind).toBe('new')
    })
  })

  describe('a clock that is not monotonic', () => {
    // NTP correction or a sleep/wake can put the last capture in the future.
    // Splitting the bundle would be the worst possible response: the user did
    // nothing wrong and their evidence would scatter.
    it('appends when the last capture appears to be in the future', () => {
      expect(decideDestination(activeAgo(-5 * MINUTE), NOW).kind).toBe('append')
    })

    it('appends rather than throwing on an invalid timestamp', () => {
      const active: ActiveBundle = { id: 'x', lastCaptureAt: new Date(Number.NaN) }
      expect(decideDestination(active, NOW).kind).toBe('append')
    })
  })

  describe('the threshold is tunable', () => {
    it('honours a shorter window', () => {
      expect(decideDestination(activeAgo(3 * MINUTE), NOW, 2 * MINUTE).kind).toBe('new')
    })

    it('honours a longer window', () => {
      expect(decideDestination(activeAgo(45 * MINUTE), NOW, 60 * MINUTE).kind).toBe('append')
    })

    it('defaults to twenty minutes', () => {
      expect(STALE_AFTER_MS).toBe(20 * MINUTE)
    })
  })
})
