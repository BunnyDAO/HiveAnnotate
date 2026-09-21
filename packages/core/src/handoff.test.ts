import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { isAbsolute } from 'node:path'
import {
  AdapterRegistry,
  bundlePointer,
  parseBundlePointer,
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
  return { bundle, directory: join(root, bundle.id), pointer: bundlePointer(bundle.id, join(root, bundle.id)) }
}

describe('the text pointer', () => {
  it('is a single line of plain text', async () => {
    const t = await target()
    expect(t.pointer).not.toContain('\n')
  })

  // The first format, "use hive bundle <id>", meant nothing to an agent that
  // had not been built alongside HiveAnnotate. Tested by handing both formats
  // to a fresh zero-context agent: only the self-describing one was found.
  it('names the product, the id, and an absolute path to bundle.md', async () => {
    const t = await target()
    expect(t.pointer).toContain(`HiveAnnotate bundle ${t.bundle.id}`)
    const path = t.pointer.match(/Read (\S+bundle\.md)/)?.[1]
    expect(path).toBeDefined()
    expect(isAbsolute(path!)).toBe(true)
    expect(existsSync(path!)).toBe(true)
  })

  it('round-trips: the id it names resolves to that bundle', async () => {
    const t = await target()
    const id = parseBundlePointer(t.pointer)
    expect(id).toBe(t.bundle.id)
    expect((await store.getBundle(id!)).id).toBe(t.bundle.id)
  })

  it('still understands the original "use hive bundle" format', () => {
    // Old pointers live on in clipboards and chat history.
    expect(parseBundlePointer('use hive bundle 2026-09-21-test')).toBe('2026-09-21-test')
  })

  it('returns null for text that is not a pointer', () => {
    expect(parseBundlePointer('just some notes')).toBeNull()
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
