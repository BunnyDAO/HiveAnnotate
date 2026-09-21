import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { defaultBundleRoot } from './bundleRoot.ts'

describe('defaultBundleRoot', () => {
  // BundleStore takes its root as a constructor argument with no default, so a
  // test can never accidentally write into the real location. This function is
  // the one place that knows where production data lives.
  it('is ~/HiveAnnotate/bundles', () => {
    expect(defaultBundleRoot()).toBe(join(homedir(), 'HiveAnnotate', 'bundles'))
  })

  it('honours an explicit override, so a second profile is possible', () => {
    expect(defaultBundleRoot({ HIVEANNOTATE_HOME: '/tmp/elsewhere' })).toBe(
      join('/tmp/elsewhere', 'bundles'),
    )
  })
})
