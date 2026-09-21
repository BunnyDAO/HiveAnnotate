/**
 * Remembers which Bundle is active across restarts.
 *
 * The pointer is persisted with its last-capture time, so the staleness rule
 * keeps meaning the same thing after a restart: restarting two minutes after a
 * capture continues the Bundle, restarting the next morning does not. Using
 * launch time instead would silently split one problem across two Bundles for
 * anyone who restarts mid-debug — exactly what staleness exists to prevent.
 *
 * This is a pointer, never a source of truth. BundleStore owns Bundle contents.
 */

import { readFile, writeFile, rename, rm } from 'node:fs/promises'
import type { ActiveBundle } from './activeBundlePolicy.ts'

interface Persisted {
  id: string
  lastCaptureAt: string
}

export interface ActiveBundleTrackerDeps {
  /** Lets the tracker forget a Bundle that has since been deleted from disk. */
  bundleExists: (id: string) => Promise<boolean>
}

export class ActiveBundleTracker {
  private readonly file: string
  private readonly deps: ActiveBundleTrackerDeps

  constructor(file: string, deps: ActiveBundleTrackerDeps) {
    this.file = file
    this.deps = deps
  }

  async current(): Promise<ActiveBundle | null> {
    let persisted: Persisted
    try {
      persisted = JSON.parse(await readFile(this.file, 'utf8')) as Persisted
    } catch {
      // Losing the pointer is harmless: the worst case is opening a new Bundle.
      // A damaged manifest is a different matter and is reported loudly.
      return null
    }

    if (typeof persisted?.id !== 'string' || typeof persisted?.lastCaptureAt !== 'string') {
      return null
    }

    const lastCaptureAt = new Date(persisted.lastCaptureAt)
    if (Number.isNaN(lastCaptureAt.getTime())) return null

    // The Bundle may have been deleted from the Catalogue since. Pointing at it
    // would make the next capture fail; forgetting it just starts a new one.
    if (!(await this.deps.bundleExists(persisted.id))) return null

    return { id: persisted.id, lastCaptureAt }
  }

  async record(id: string, lastCaptureAt: Date): Promise<void> {
    const payload: Persisted = { id, lastCaptureAt: lastCaptureAt.toISOString() }

    // Write-then-rename: a hard kill can leave the old pointer or the new one,
    // never a half-written file.
    const temp = `${this.file}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(payload))
    await rename(temp, this.file)
  }

  async clear(): Promise<void> {
    await rm(this.file, { force: true })
  }
}
