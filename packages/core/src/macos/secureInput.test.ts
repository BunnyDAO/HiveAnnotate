import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SecureInputWatcher } from './secureInput.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('watching Secure Input', () => {
  it('reports the state it starts in', async () => {
    const watcher = new SecureInputWatcher({ probe: async () => true, intervalMs: 500 })
    const seen: boolean[] = []
    watcher.onChange((v) => seen.push(v))

    watcher.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(seen).toEqual([true])
    watcher.stop()
  })

  it('notices it turning on within a second', async () => {
    let enabled = false
    const watcher = new SecureInputWatcher({ probe: async () => enabled, intervalMs: 500 })
    const seen: boolean[] = []
    watcher.onChange((v) => seen.push(v))

    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    enabled = true
    await vi.advanceTimersByTimeAsync(1000)

    expect(seen).toEqual([false, true])
    watcher.stop()
  })

  // The user does nothing to release Secure Input — they just move on from the
  // password field. If the blocked indicator stuck, the app would look broken.
  it('clears by itself when Secure Input releases', async () => {
    let enabled = true
    const watcher = new SecureInputWatcher({ probe: async () => enabled, intervalMs: 500 })
    const seen: boolean[] = []
    watcher.onChange((v) => seen.push(v))

    watcher.start()
    await vi.advanceTimersByTimeAsync(0)
    enabled = false
    await vi.advanceTimersByTimeAsync(1000)

    expect(seen).toEqual([true, false])
    watcher.stop()
  })

  it('only reports changes, not every poll', async () => {
    const watcher = new SecureInputWatcher({ probe: async () => false, intervalMs: 100 })
    const seen: boolean[] = []
    watcher.onChange((v) => seen.push(v))

    watcher.start()
    await vi.advanceTimersByTimeAsync(1000)

    expect(seen).toEqual([false])
    watcher.stop()
  })

  it('keeps polling when the probe throws, instead of dying silently', async () => {
    let calls = 0
    const watcher = new SecureInputWatcher({
      probe: async () => {
        calls++
        if (calls < 3) throw new Error('helper busy')
        return true
      },
      intervalMs: 100,
    })
    const seen: boolean[] = []
    watcher.onChange((v) => seen.push(v))

    watcher.start()
    await vi.advanceTimersByTimeAsync(500)

    expect(calls).toBeGreaterThanOrEqual(3)
    expect(seen).toEqual([true])
    watcher.stop()
  })

  it('stops polling once stopped', async () => {
    const probe = vi.fn(async () => false)
    const watcher = new SecureInputWatcher({ probe, intervalMs: 100 })

    watcher.start()
    await vi.advanceTimersByTimeAsync(300)
    const before = probe.mock.calls.length
    watcher.stop()
    await vi.advanceTimersByTimeAsync(1000)

    expect(probe.mock.calls.length).toBe(before)
  })
})
