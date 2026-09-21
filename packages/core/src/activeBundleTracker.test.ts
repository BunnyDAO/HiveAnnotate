import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ActiveBundleTracker } from './activeBundleTracker.ts'
import { decideDestination, STALE_AFTER_MS } from './activeBundlePolicy.ts'

let home: string
let file: string
let present: Set<string>
let tracker: ActiveBundleTracker

const NOW = new Date('2026-09-20T14:00:00.000Z')
const MINUTE = 60_000

function trackerFor(): ActiveBundleTracker {
  return new ActiveBundleTracker(file, { bundleExists: async (id) => present.has(id) })
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'hive-active-'))
  file = join(home, 'active.json')
  present = new Set(['2026-09-20-sidebar-collapses'])
  tracker = trackerFor()
})
afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('across a restart', () => {
  it('continues the same bundle when the restart is inside the window', async () => {
    await tracker.record('2026-09-20-sidebar-collapses', new Date(NOW.getTime() - 2 * MINUTE))

    // A brand new process: nothing carried over in memory.
    const afterRestart = await trackerFor().current()

    expect(decideDestination(afterRestart, NOW)).toEqual({
      kind: 'append',
      bundleId: '2026-09-20-sidebar-collapses',
    })
  })

  it('opens a new bundle when the restart is outside the window', async () => {
    await tracker.record('2026-09-20-sidebar-collapses', new Date(NOW.getTime() - 3 * 60 * MINUTE))

    const afterRestart = await trackerFor().current()

    expect(decideDestination(afterRestart, NOW)).toEqual({ kind: 'new', reason: 'stale' })
  })

  it('measures staleness from the last capture, not from when the app started', async () => {
    const lastCapture = new Date(NOW.getTime() - (STALE_AFTER_MS - MINUTE))
    await tracker.record('2026-09-20-sidebar-collapses', lastCapture)

    const restored = await trackerFor().current()

    // If launch time were used, this would look brand new and append forever.
    expect(restored?.lastCaptureAt.toISOString()).toBe(lastCapture.toISOString())
    expect(decideDestination(restored, NOW).kind).toBe('append')
    expect(decideDestination(restored, new Date(NOW.getTime() + 2 * MINUTE)).kind).toBe('new')
  })
})

describe('when there is nothing to restore', () => {
  it('reports no active bundle on a first ever run', async () => {
    expect(await tracker.current()).toBeNull()
  })

  it('reports no active bundle when the file is unreadable', async () => {
    await writeFile(file, '{ not json')
    // Losing the active pointer is harmless — the worst case is starting a new
    // Bundle. That is why this degrades quietly, unlike a damaged manifest,
    // which would mean losing captures.
    expect(await tracker.current()).toBeNull()
  })

  it('reports no active bundle when the one it names has been deleted', async () => {
    await tracker.record('2026-09-20-sidebar-collapses', NOW)
    present.clear()

    expect(await trackerFor().current()).toBeNull()
    expect(decideDestination(await trackerFor().current(), NOW).kind).toBe('new')
  })

  it('clears on demand', async () => {
    await tracker.record('2026-09-20-sidebar-collapses', NOW)
    await tracker.clear()
    expect(await tracker.current()).toBeNull()
  })
})

describe('durability', () => {
  it('writes atomically, leaving no partial file behind', async () => {
    await tracker.record('2026-09-20-sidebar-collapses', NOW)

    // A rename-into-place leaves exactly the target file and no temp litter,
    // so a hard kill can never produce a half-written pointer.
    expect(await readdir(home)).toEqual(['active.json'])
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
      id: '2026-09-20-sidebar-collapses',
      lastCaptureAt: NOW.toISOString(),
    })
  })

  it('overwrites the previous pointer rather than accumulating', async () => {
    present.add('2026-09-20-second-thing')
    await tracker.record('2026-09-20-sidebar-collapses', NOW)
    await tracker.record('2026-09-20-second-thing', NOW)

    expect((await trackerFor().current())?.id).toBe('2026-09-20-second-thing')
    expect(await readdir(home)).toEqual(['active.json'])
  })
})
