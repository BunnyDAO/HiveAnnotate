import { describe, it, expect } from 'vitest'
import { explainFailure } from './explainFailure.ts'
import type { CaptureFailure } from './macos/captureBackend.ts'

const ALL: CaptureFailure[] = ['no-permission', 'stale-window-id', 'write-failure', 'unknown']

describe('explaining a failed capture', () => {
  it.each(ALL)('has a distinct explanation for %s', (reason) => {
    const others = ALL.filter((r) => r !== reason).map((r) => explainFailure(r).title)
    expect(others).not.toContain(explainFailure(reason).title)
  })

  it.each(ALL)('always offers a way forward for %s', (reason) => {
    const explained = explainFailure(reason)
    expect(explained.title).not.toBe('')
    expect(explained.detail).not.toBe('')
    expect(explained.retryLabel).not.toBe('')
  })

  it('tells the truth about the permission case: nothing was captured', () => {
    const explained = explainFailure('no-permission')
    expect(explained.detail).toMatch(/nothing was (taken|captured)/i)
    // Offering System Settings is the only action that actually helps here.
    expect(explained.settingsPane).toBe('ScreenCapture')
  })

  it('offers the whole screen when a window vanished', () => {
    // The user was pointing at something that no longer exists; capturing the
    // screen is the recovery that keeps their note useful.
    expect(explainFailure('stale-window-id').alternative).toMatch(/screen/i)
  })

  it('says a write failure means it is NOT saved', () => {
    const explained = explainFailure('write-failure')
    expect(explained.detail).toMatch(/not saved|could not/i)
    // A capture that is not on disk does not exist; the bar must not imply it does.
    expect(explained.blocking).toBe(true)
  })

  it('does not claim to know what an unknown failure was', () => {
    const explained = explainFailure('unknown', 'something else entirely')
    expect(explained.detail).toContain('something else entirely')
  })

  it('reads sensibly with no detail supplied', () => {
    expect(explainFailure('unknown').detail).not.toContain('undefined')
  })

  it('only blocks dismissal for a write failure', () => {
    expect(explainFailure('no-permission').blocking).toBe(false)
    expect(explainFailure('stale-window-id').blocking).toBe(false)
    expect(explainFailure('write-failure').blocking).toBe(true)
  })
})
