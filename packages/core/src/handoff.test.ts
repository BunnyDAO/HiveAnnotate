import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AdapterRegistry,
  bundlePointer,
  createClipboardAdapter,
  createFolderAdapter,
} from './handoff.ts'
import type { HandoffAdapter, HandoffTarget } from './handoff.ts'
import { BundleStore } from './bundleStore.ts'

let root: string
let store: BundleStore

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'hive-handoff-'))
  store = new BundleStore(root)
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function target(): Promise<HandoffTarget> {
  const bundle = await store.createBundle({
    image: new Uint8Array([1, 2, 3]),
    note: 'sidebar collapses',
    kind: 'window',
    app: 'Safari',
    width: 100,
    height: 50,
    takenAt: new Date('2026-09-20T14:00:00Z'),
  })
  return { bundle, directory: join(root, bundle.id), pointer: bundlePointer(bundle.id) }
}

describe('the text pointer', () => {
  it('is a single line of plain text naming the bundle', () => {
    const pointer = bundlePointer('2026-09-20-sidebar-collapses')
    expect(pointer).toBe('use hive bundle 2026-09-20-sidebar-collapses')
    expect(pointer).not.toContain('\n')
  })

  it('round-trips: the id it names resolves to that bundle', async () => {
    const t = await target()
    const id = bundlePointer(t.bundle.id).replace('use hive bundle ', '')
    expect((await store.getBundle(id)).id).toBe(t.bundle.id)
  })
})

describe('the clipboard adapter', () => {
  // Images are deliberately not copied: a terminal cannot paste one, which is
  // why clipboard was rejected as the primary handoff path in the first place.
  it('writes only the pointer text, never image data', async () => {
    const writeText = vi.fn()
    const t = await target()

    await createClipboardAdapter({ writeText }).handoff(t)

    expect(writeText).toHaveBeenCalledOnce()
    const written = writeText.mock.calls[0]![0] as string
    expect(typeof written).toBe('string')
    expect(written).toBe(t.pointer)
    expect(written.split('\n')).toHaveLength(1)
  })
})

describe('the folder adapter', () => {
  it('reveals the bundle directory', async () => {
    const reveal = vi.fn()
    const t = await target()

    await createFolderAdapter({ reveal }).handoff(t)

    expect(reveal).toHaveBeenCalledWith(t.directory)
  })
})

describe('the registry', () => {
  it('invokes an adapter purely by id, knowing nothing about what it is', async () => {
    const handoff = vi.fn()
    const registry = new AdapterRegistry()
    registry.register({ id: 'folder', label: 'Reveal folder', handoff })

    await registry.handoff('folder', await target())

    expect(handoff).toHaveBeenCalledOnce()
  })

  it('lists what is registered', () => {
    const registry = new AdapterRegistry()
    registry.register(createFolderAdapter({ reveal: vi.fn() }))
    registry.register(createClipboardAdapter({ writeText: vi.fn() }))

    expect(registry.list().map((a) => a.id)).toEqual(['folder', 'clipboard'])
  })

  // The agnostic claim, made mechanical: if a new destination ever needs a
  // change inside core, the core is no longer destination-agnostic.
  it('accepts a brand new adapter with no change to any core module', async () => {
    const seen: string[] = []
    const invented: HandoffAdapter = {
      id: 'carrier-pigeon',
      label: 'Carrier pigeon',
      handoff: async (t) => { seen.push(t.bundle.id) },
    }

    const registry = new AdapterRegistry()
    registry.register(invented)
    const t = await target()
    await registry.handoff('carrier-pigeon', t)

    expect(seen).toEqual([t.bundle.id])
  })

  it('rejects an unknown adapter id', async () => {
    const registry = new AdapterRegistry()
    await expect(registry.handoff('nope', await target())).rejects.toThrow(/nope/)
  })

  it('refuses to register the same id twice', () => {
    const registry = new AdapterRegistry()
    registry.register(createFolderAdapter({ reveal: vi.fn() }))
    expect(() => registry.register(createFolderAdapter({ reveal: vi.fn() }))).toThrow(/folder/)
  })

  it('surfaces which adapter failed, and leaves the bundle untouched', async () => {
    const registry = new AdapterRegistry()
    registry.register({
      id: 'flaky',
      label: 'Flaky',
      handoff: async () => { throw new Error('network down') },
    })
    const t = await target()

    await expect(registry.handoff('flaky', t)).rejects.toThrow(/flaky/)

    // The bundle is still there and still readable: a failed handoff costs
    // the handoff, never the work.
    expect((await store.getBundle(t.bundle.id)).captures).toHaveLength(1)
    // And the registry still works afterwards.
    expect(registry.list()).toHaveLength(1)
  })
})
