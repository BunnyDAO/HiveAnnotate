import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, readFile, access, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BundleStore } from './bundleStore.ts'
import type { NewCapture } from './bundleStore.ts'

let root: string
let store: BundleStore

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'hive-store-'))
  store = new BundleStore(root)
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

function capture(overrides: Partial<NewCapture> = {}): NewCapture {
  return {
    image: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    note: 'sidebar collapses when the modal opens',
    kind: 'window',
    app: 'Safari',
    width: 1512,
    height: 982,
    takenAt: new Date('2026-09-20T14:22:00Z'),
    ...overrides,
  }
}

describe('creating a bundle', () => {
  it('round-trips through disk with the first note seeding the intent', async () => {
    const created = await store.createBundle(capture())
    const read = await store.getBundle(created.id)

    expect(read.intent).toBe('sidebar collapses when the modal opens')
    expect(read.status).toBe('open')
    expect(read.captures).toHaveLength(1)
    expect(read.captures[0]).toMatchObject({
      index: 1,
      file: '001.png',
      note: 'sidebar collapses when the modal opens',
      kind: 'window',
      app: 'Safari',
      width: 1512,
      height: 982,
    })
  })

  it('writes the image bytes next to the manifest', async () => {
    const created = await store.createBundle(capture())
    const onDisk = await readFile(join(root, created.id, '001.png'))
    expect([...onDisk]).toEqual([0x89, 0x50, 0x4e, 0x47])
  })
})

describe('appending captures', () => {
  it('keeps them in capture order and numbers them sequentially', async () => {
    const { id } = await store.createBundle(capture({ note: 'first' }))
    await store.appendCapture(id, capture({ note: 'second' }))
    await store.appendCapture(id, capture({ note: 'third' }))

    const read = await store.getBundle(id)

    expect(read.captures.map((c) => c.note)).toEqual(['first', 'second', 'third'])
    expect(read.captures.map((c) => c.file)).toEqual(['001.png', '002.png', '003.png'])
  })

  it('leaves the intent seeded by the first note alone', async () => {
    const { id } = await store.createBundle(capture({ note: 'first' }))
    await store.appendCapture(id, capture({ note: 'second' }))

    expect((await store.getBundle(id)).intent).toBe('first')
  })
})

describe('bundle ids', () => {
  it('is dated and derived from the first note', async () => {
    const { id } = await store.createBundle(capture({ note: 'Sidebar collapses' }))
    expect(id).toBe('2026-09-20-sidebar-collapses')
  })

  it('disambiguates a collision instead of overwriting', async () => {
    const a = await store.createBundle(capture({ note: 'same problem' }))
    const b = await store.createBundle(capture({ note: 'same problem' }))
    const c = await store.createBundle(capture({ note: 'same problem' }))

    expect(new Set([a.id, b.id, c.id]).size).toBe(3)
    expect([a.id, b.id, c.id]).toEqual([
      '2026-09-20-same-problem',
      '2026-09-20-same-problem-2',
      '2026-09-20-same-problem-3',
    ])
  })

  it('keeps the earlier bundle intact when a collision happens', async () => {
    const a = await store.createBundle(capture({ note: 'same problem' }))
    await store.appendCapture(a.id, capture({ note: 'more evidence' }))
    await store.createBundle(capture({ note: 'same problem' }))

    expect((await store.getBundle(a.id)).captures).toHaveLength(2)
  })

  it('stays within the root for a hostile note', async () => {
    const { id } = await store.createBundle(capture({ note: '../../etc/passwd' }))
    expect(id).not.toContain('/')
    expect(await store.getBundle(id)).toBeTruthy()
  })
})

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

describe('deleting a capture', () => {
  it('removes it and its image file', async () => {
    const { id } = await store.createBundle(capture({ note: 'first' }))
    await store.appendCapture(id, capture({ note: 'second' }))

    await store.deleteCapture(id, 1)

    const read = await store.getBundle(id)
    expect(read.captures.map((c) => c.note)).toEqual(['second'])
    expect(await exists(join(root, id, '001.png'))).toBe(false)
    expect(await exists(join(root, id, '002.png'))).toBe(true)
  })

  it('does not renumber the survivors', async () => {
    const { id } = await store.createBundle(capture({ note: 'first' }))
    await store.appendCapture(id, capture({ note: 'second' }))
    await store.appendCapture(id, capture({ note: 'third' }))

    await store.deleteCapture(id, 2)

    const read = await store.getBundle(id)
    expect(read.captures.map((c) => c.index)).toEqual([1, 3])
    expect(read.captures.map((c) => c.file)).toEqual(['001.png', '003.png'])
  })

  it('never reuses a deleted index for a later capture', async () => {
    const { id } = await store.createBundle(capture({ note: 'first' }))
    await store.appendCapture(id, capture({ note: 'second' }))
    await store.deleteCapture(id, 2)
    await store.appendCapture(id, capture({ note: 'third' }))

    const read = await store.getBundle(id)
    expect(read.captures.map((c) => c.index)).toEqual([1, 3])
    // 002.png was deleted; reusing the number would silently attach the old
    // note's evidence to a new observation.
    expect(read.captures.map((c) => c.file)).toEqual(['001.png', '003.png'])
  })

  it('leaves a valid, readable bundle when the last capture goes', async () => {
    const { id } = await store.createBundle(capture({ note: 'only one' }))

    await store.deleteCapture(id, 1)

    const read = await store.getBundle(id)
    expect(read.captures).toEqual([])
    // The Intent outlives its seeding capture — it is the thing an agent acts on.
    expect(read.intent).toBe('only one')
    expect(read.status).toBe('open')
  })

  it('rejects an index that is not in the bundle', async () => {
    const { id } = await store.createBundle(capture())
    await expect(store.deleteCapture(id, 99)).rejects.toThrow(/99/)
  })
})

describe('moving a capture between bundles', () => {
  it('moves the record and the image file, renumbered for its new home', async () => {
    const a = await store.createBundle(capture({ note: 'wrong bundle' }))
    await store.appendCapture(a.id, capture({ note: 'misfiled evidence' }))
    const b = await store.createBundle(capture({ note: 'right bundle' }))

    const { from, to } = await store.moveCapture(a.id, 2, b.id)

    expect(from.captures.map((c) => c.note)).toEqual(['wrong bundle'])
    expect(to.captures.map((c) => c.note)).toEqual(['right bundle', 'misfiled evidence'])
    expect(to.captures[1]).toMatchObject({ index: 2, file: '002.png' })

    expect(await exists(join(root, a.id, '002.png'))).toBe(false)
    expect(await exists(join(root, b.id, '002.png'))).toBe(true)
  })

  it('carries the image bytes across intact', async () => {
    const a = await store.createBundle(capture({ note: 'source' }))
    await store.appendCapture(a.id, capture({ note: 'moved', image: new Uint8Array([1, 2, 3, 4]) }))
    const b = await store.createBundle(capture({ note: 'target' }))

    await store.moveCapture(a.id, 2, b.id)

    expect([...(await readFile(join(root, b.id, '002.png')))]).toEqual([1, 2, 3, 4])
  })

  it('rewrites bundle.md on both sides', async () => {
    const a = await store.createBundle(capture({ note: 'source bundle' }))
    await store.appendCapture(a.id, capture({ note: 'the moved note' }))
    const b = await store.createBundle(capture({ note: 'target bundle' }))

    await store.moveCapture(a.id, 2, b.id)

    const sourceMd = await readFile(join(root, a.id, 'bundle.md'), 'utf8')
    const targetMd = await readFile(join(root, b.id, 'bundle.md'), 'utf8')
    expect(sourceMd).not.toContain('the moved note')
    expect(targetMd).toContain('the moved note')
  })

  it('does not reuse the vacated number in the source bundle', async () => {
    const a = await store.createBundle(capture({ note: 'source' }))
    await store.appendCapture(a.id, capture({ note: 'moved away' }))
    const b = await store.createBundle(capture({ note: 'target' }))

    await store.moveCapture(a.id, 2, b.id)
    await store.appendCapture(a.id, capture({ note: 'added later' }))

    expect((await store.getBundle(a.id)).captures.map((c) => c.index)).toEqual([1, 3])
  })

  it('can move a capture out into a brand new bundle named after it', async () => {
    const a = await store.createBundle(capture({ note: 'the real problem' }))
    await store.appendCapture(a.id, capture({ note: 'Actually a separate bug' }))

    const { from, to } = await store.moveCaptureToNewBundle(a.id, 2)

    expect(from.captures.map((c) => c.note)).toEqual(['the real problem'])
    expect(to.id).toBe('2026-09-20-actually-a-separate-bug')
    expect(to.intent).toBe('Actually a separate bug')
    expect(to.captures).toEqual([expect.objectContaining({ index: 1, file: '001.png' })])
    expect(await exists(join(root, to.id, '001.png'))).toBe(true)
  })

  it('refuses to move a capture onto itself', async () => {
    const a = await store.createBundle(capture())
    await expect(store.moveCapture(a.id, 1, a.id)).rejects.toThrow()
  })

  it('rejects a move to a bundle that does not exist, leaving the source untouched', async () => {
    const a = await store.createBundle(capture({ note: 'source' }))
    await store.appendCapture(a.id, capture({ note: 'stays put' }))

    await expect(store.moveCapture(a.id, 2, 'no-such-bundle')).rejects.toThrow()

    expect((await store.getBundle(a.id)).captures).toHaveLength(2)
    expect(await exists(join(root, a.id, '002.png'))).toBe(true)
  })
})

describe('listing bundles', () => {
  it('returns them newest first with a capture count', async () => {
    await store.createBundle(capture({ note: 'oldest', takenAt: new Date('2026-09-18T09:00:00Z') }))
    const mid = await store.createBundle(capture({ note: 'middle', takenAt: new Date('2026-09-19T09:00:00Z') }))
    await store.appendCapture(mid.id, capture({ note: 'more', takenAt: new Date('2026-09-19T09:05:00Z') }))
    await store.createBundle(capture({ note: 'newest', takenAt: new Date('2026-09-20T09:00:00Z') }))

    const listed = await store.listBundles()

    expect(listed.map((b) => b.intent)).toEqual(['newest', 'middle', 'oldest'])
    expect(listed[1]).toMatchObject({ captureCount: 2 })
  })

  it('is empty, not an error, when nothing has been captured yet', async () => {
    expect(await store.listBundles()).toEqual([])
  })
})

describe('editing', () => {
  it('changes a note and rewrites bundle.md', async () => {
    const { id } = await store.createBundle(capture({ note: 'hasty wording' }))

    const updated = await store.editNote(id, 1, 'sharpened wording')

    expect(updated.captures[0]?.note).toBe('sharpened wording')
    expect(await readFile(join(root, id, 'bundle.md'), 'utf8')).toContain('sharpened wording')
  })

  it('leaves the intent alone when a seeding note is edited', async () => {
    const { id } = await store.createBundle(capture({ note: 'original' }))
    const updated = await store.editNote(id, 1, 'rewritten')
    expect(updated.intent).toBe('original')
  })

  it('changes the intent without renaming the bundle', async () => {
    const { id } = await store.createBundle(capture({ note: 'sidebar collapses' }))

    const updated = await store.editIntent(id, 'keep the nav pinned while a modal is up')

    expect(updated.intent).toBe('keep the nav pinned while a modal is up')
    // Renaming would break any pointer an agent was already handed.
    expect(updated.id).toBe(id)
    expect(await readFile(join(root, id, 'bundle.md'), 'utf8')).toContain('keep the nav pinned')
  })
})

describe('closing a bundle', () => {
  it('marks it closed and survives a reread', async () => {
    const { id } = await store.createBundle(capture())
    await store.closeBundle(id)
    expect((await store.getBundle(id)).status).toBe('closed')
  })
})

describe('a damaged manifest', () => {
  it('is reported as an error rather than read as an empty bundle', async () => {
    const { id } = await store.createBundle(capture())
    await writeFile(join(root, id, 'manifest.json'), '{ "id": "trunc')

    await expect(store.getBundle(id)).rejects.toThrow(new RegExp(id))
  })

  it('does not hide a damaged bundle from the listing', async () => {
    const good = await store.createBundle(capture({ note: 'fine', takenAt: new Date('2026-09-20T10:00:00Z') }))
    const bad = await store.createBundle(capture({ note: 'damaged', takenAt: new Date('2026-09-20T11:00:00Z') }))
    await writeFile(join(root, bad.id, 'manifest.json'), 'not json at all')

    const listed = await store.listBundles()

    expect(listed.map((b) => b.id)).toContain(good.id)
    expect(listed.find((b) => b.id === bad.id)).toMatchObject({ damaged: true })
  })
})

describe('the date in a bundle id', () => {
  it('is the local date, not UTC', async () => {
    // Captured late in the evening, UTC has already rolled over. A bundle made
    // tonight must not be filed under tomorrow's date — the Catalogue is
    // scanned by eye, and a date that disagrees with the user is a bug.
    const lateEvening = new Date('2026-09-21T04:00:00Z') // 21:00 on the 20th, UTC-7
    const { id } = await store.createBundle(capture({ note: 'evening bug', takenAt: lateEvening }))

    const local = new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(lateEvening)

    expect(id.startsWith(local)).toBe(true)
  })
})
