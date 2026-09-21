import { describe, it, expect } from 'vitest'
import { BUNDLE_ID, APP_NAME } from './appInfo.ts'

describe('app identity', () => {
  // A pinned-value test is normally a change-detector smell. Here it is the
  // requirement: macOS keys the Screen Recording (TCC) grant to the signing
  // identity, which includes the bundle identifier. Changing it silently
  // revokes the user's permission and re-prompts them. This test exists to
  // make that change impossible to do by accident.
  it('has a bundle identifier that must never change', () => {
    expect(BUNDLE_ID).toBe('io.hiveop.hiveannotate')
  })

  it('names the app', () => {
    expect(APP_NAME).toBe('HiveAnnotate')
  })
})
