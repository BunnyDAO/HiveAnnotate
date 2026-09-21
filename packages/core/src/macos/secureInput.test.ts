import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SecureInputWatcher } from './secureInput.ts'
import type { SecureInputState } from './secureInput.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function watch(probe: () => Promise<SecureInputState | boolean>, intervalMs = 500) {
  const watcher = new SecureInputWatcher({ probe, intervalMs })
  const seen: SecureInputState[] = []
  watcher.onChange((s) => seen.push(s))
  return { watcher, seen }
}

describe('watching Secure Input', () => {
  it('reports the state it starts in', async () => {
    const { watcher, seen } = watch(async () => ({ enabled: true, holder: 'iTerm2' }))
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual([{ enabled: true, holder: 'iTerm2' }])
    watcher.stop()
  })

  it('names the app holding it, so the user knows what to close', async () => {
    const { watcher, seen } = watch(async () => ({ enabled: true, holder: '1Password' }))
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(seen[0]?.holder).toBe('1Password')
    watcher.stop()
  })

  it('notices it turning on within a second', async () => {
    let state: SecureInputState = { enabled: false }
    const { watcher, seen } = watch(async () => state)
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    state = { enabled: true, holder: 'iTerm2' }
    await vi.advanceTimersByTimeAsync(1000)
    expect(seen.map((s) => s.enabled)).toEqual([false, true])
    watcher.stop()
  })

  // The user does nothing to release Secure Input — they just move on from the
  // password field. If the blocked indicator stuck, the app would look broken.
  it('clears by itself when Secure Input releases', async () => {
    let state: SecureInputState = { enabled: true, holder: 'iTerm2' }
    const { watcher, seen } = watch(async () => state)
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    state = { enabled: false }
    await vi.advanceTimersByTimeAsync(1000)
    expect(seen.map((s) => s.enabled)).toEqual([true, false])
    watcher.stop()
  })

  it('reports a change of holder while still blocked', async () => {
    let state: SecureInputState = { enabled: true, holder: 'iTerm2' }
    const { watcher, seen } = watch(async () => state)
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    state = { enabled: true, holder: '1Password' }
    await vi.advanceTimersByTimeAsync(1000)
    expect(seen.map((s) => s.holder)).toEqual(['iTerm2', '1Password'])
    watcher.stop()
  })

  it('only reports changes, not every poll', async () => {
    const { watcher, seen } = watch(async () => ({ enabled: false }), 100)
    watcher.start()
    await vi.advanceTimersByTimeAsync(1000)
    expect(seen).toHaveLength(1)
    watcher.stop()
  })

  it('still accepts a plain boolean probe', async () => {
    const { watcher, seen } = watch(async () => true)
    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual([{ enabled: true }])
    watcher.stop()
  })

  it('keeps polling when the probe throws, instead of dying silently', async () => {
    let calls = 0
    const { watcher, seen } = watch(async () => {
      calls++
      if (calls < 3) throw new Error('helper busy')
      return { enabled: true, holder: 'iTerm2' }
    }, 100)
    watcher.start()
    await vi.advanceTimersByTimeAsync(500)
    expect(calls).toBeGreaterThanOrEqual(3)
    expect(seen).toHaveLength(1)
    watcher.stop()
  })

  it('stops polling once stopped', async () => {
    const probe = vi.fn(async () => ({ enabled: false }))
    const watcher = new SecureInputWatcher({ probe, intervalMs: 100 })
    watcher.start()
    await vi.advanceTimersByTimeAsync(300)
    const before = probe.mock.calls.length
    watcher.stop()
    await vi.advanceTimersByTimeAsync(1000)
    expect(probe.mock.calls.length).toBe(before)
  })
})
