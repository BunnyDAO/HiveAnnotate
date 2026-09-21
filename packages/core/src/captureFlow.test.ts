import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CaptureFlow } from './captureFlow.ts'
import { BundleStore } from './bundleStore.ts'
import { ActiveBundleTracker } from './activeBundleTracker.ts'
import { AdapterRegistry } from './handoff.ts'
import type { CaptureBackend, CaptureResult } from './macos/captureBackend.ts'

let home: string
let store: BundleStore
let tracker: ActiveBundleTracker
let registry: AdapterRegistry
let copied: string[]
let now: Date

const MINUTE = 60_000

function backendReturning(result: CaptureResult): CaptureBackend {
  return { capture: async () => result }
}

const goodCapture: CaptureResult = {
  ok: true,
  image: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  width: 3024,
  height: 1964,
  kind: 'window',
}

function flow(backend: CaptureBackend = backendReturning(goodCapture)): CaptureFlow {
  return new CaptureFlow({
    backend,
    store,
    tracker,
    registry,
    now: () => now,
    bundleRoot: join(home, 'bundles'),
  })
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'hive-flow-'))
  store = new BundleStore(join(home, 'bundles'))
  tracker = new ActiveBundleTracker(join(home, 'active.json'), {
    bundleExists: async (id) => store.getBundle(id).then(() => true, () => false),
  })
  copied = []
  registry = new AdapterRegistry()
  registry.register({
    id: 'clipboard',
    label: 'Copy link',
    handoff: async (t) => { copied.push(t.pointer) },
  })
  now = new Date('2026-09-20T14:00:00Z')
})
afterEach(async () => {
  await rm(home, { recursive: true, force: true })
})

describe('beginning a capture', () => {
  it('reports the destination so the bar can show it before the user commits', async () => {
    const pending = await flow().begin({ kind: 'window', windowId: 1 })

    expect(pending.ok).toBe(true)
    if (pending.ok) expect(pending.pending.destination).toEqual({ kind: 'new', reason: 'no-active-bundle' })
  })

  it('says the active bundle went stale, rather than silently starting a new one', async () => {
    const first = await flow().begin({ kind: 'window', windowId: 1 })
    if (!first.ok) throw new Error('setup')
    await flow().commit(first.pending, 'the original problem', { target: { kind: 'active' } })

    now = new Date(now.getTime() + 45 * MINUTE)
    const later = await flow().begin({ kind: 'window', windowId: 1 })

    expect(later.ok).toBe(true)
    // The bar has to be able to say "this started a new bundle" *before* the
    // user hits enter, or auto-filing is a trap.
    if (later.ok) expect(later.pending.destination).toEqual({ kind: 'new', reason: 'stale' })
  })

  it('passes a capture failure straight through without opening a bundle', async () => {
    const failing = backendReturning({ ok: false, reason: 'no-permission' })

    const pending = await flow(failing).begin({ kind: 'screen' })

    expect(pending).toEqual({ ok: false, reason: 'no-permission', detail: undefined })
    expect(await store.listBundles()).toEqual([])
  })
})

describe('⏎ — file it', () => {
  it('creates a bundle seeded by the note when there is no active one', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    const bundle = await flow().commit(begun.pending, 'Sidebar collapses', {
      target: { kind: 'active' },
    })

    expect(bundle.id).toBe('2026-09-20-sidebar-collapses')
    expect(bundle.intent).toBe('Sidebar collapses')
    expect(bundle.captures).toHaveLength(1)
  })

  it('appends to the active bundle while it is fresh', async () => {
    const a = await flow().begin({ kind: 'window', windowId: 1 })
    if (!a.ok) throw new Error('setup')
    const first = await flow().commit(a.pending, 'first', { target: { kind: 'active' } })

    now = new Date(now.getTime() + 2 * MINUTE)
    const b = await flow().begin({ kind: 'window', windowId: 1 })
    if (!b.ok) throw new Error('setup')
    const second = await flow().commit(b.pending, 'second', { target: { kind: 'active' } })

    expect(second.id).toBe(first.id)
    expect(second.captures.map((c) => c.note)).toEqual(['first', 'second'])
  })

  it('records the capture facts alongside the note', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    const bundle = await flow().commit(begun.pending, 'a note', { target: { kind: 'active' } })

    expect(bundle.captures[0]).toMatchObject({ kind: 'window', width: 3024, height: 1964 })
  })
})

describe('⇧⏎ — file it and start a new bundle', () => {
  it('opens a new bundle even when the active one is fresh', async () => {
    const a = await flow().begin({ kind: 'window', windowId: 1 })
    if (!a.ok) throw new Error('setup')
    const first = await flow().commit(a.pending, 'first problem', { target: { kind: 'active' } })

    now = new Date(now.getTime() + MINUTE)
    const b = await flow().begin({ kind: 'window', windowId: 1 })
    if (!b.ok) throw new Error('setup')
    const second = await flow().commit(b.pending, 'a different problem', {
      target: { kind: 'new' },
    })

    expect(second.id).not.toBe(first.id)
    expect((await store.getBundle(first.id)).captures).toHaveLength(1)
  })

  it('makes the new bundle the active one', async () => {
    const a = await flow().begin({ kind: 'window', windowId: 1 })
    if (!a.ok) throw new Error('setup')
    const created = await flow().commit(a.pending, 'brand new', { target: { kind: 'new' } })

    expect((await tracker.current())?.id).toBe(created.id)
  })
})

describe('⇥ — file into a bundle the user picked', () => {
  it('appends to that bundle and makes it active', async () => {
    const a = await flow().begin({ kind: 'window', windowId: 1 })
    if (!a.ok) throw new Error('setup')
    const chosen = await flow().commit(a.pending, 'the older problem', { target: { kind: 'new' } })

    const b = await flow().begin({ kind: 'window', windowId: 1 })
    if (!b.ok) throw new Error('setup')
    const c = await flow().commit(b.pending, 'unrelated', { target: { kind: 'new' } })
    expect(c.id).not.toBe(chosen.id)

    const d = await flow().begin({ kind: 'window', windowId: 1 })
    if (!d.ok) throw new Error('setup')
    const result = await flow().commit(d.pending, 'belongs with the older one', {
      target: { kind: 'bundle', id: chosen.id },
    })

    expect(result.id).toBe(chosen.id)
    expect(result.captures).toHaveLength(2)
    expect((await tracker.current())?.id).toBe(chosen.id)
  })
})

describe('⌘⏎ — file it and copy the pointer', () => {
  it('files it and puts a text pointer on the clipboard', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    const bundle = await flow().commit(begun.pending, 'Sidebar collapses', {
      target: { kind: 'active' },
      copyPointer: true,
    })

    expect(copied).toHaveLength(1)
    // Self-describing, with a real absolute path any agent can open.
    expect(copied[0]).toContain(`HiveAnnotate bundle ${bundle.id}`)
    expect(copied[0]).toContain(join(home, 'bundles', bundle.id, 'bundle.md'))
  })

  it('still files the capture when the clipboard adapter fails', async () => {
    const failing = new AdapterRegistry()
    failing.register({
      id: 'clipboard',
      label: 'Copy link',
      handoff: async () => { throw new Error('clipboard unavailable') },
    })
    const f = new CaptureFlow({ backend: backendReturning(goodCapture), store, tracker, registry: failing, now: () => now, bundleRoot: join(home, 'bundles') })

    const begun = await f.begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    // A failed handoff costs the handoff, never the capture.
    const bundle = await f.commit(begun.pending, 'a note', {
      target: { kind: 'active' },
      copyPointer: true,
    })

    expect(bundle.captures).toHaveLength(1)
  })
})

describe('⎋ — discard', () => {
  it('writes nothing at all', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    await flow().discard(begun.pending)

    expect(await store.listBundles()).toEqual([])
    expect(await tracker.current()).toBeNull()
  })
})

describe('an empty note', () => {
  it('is refused when it would have to name a new bundle and no name is given', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')

    await expect(
      flow().commit(begun.pending, '   ', { target: { kind: 'active' } }),
    ).rejects.toThrow(/name/i)

    expect(await store.listBundles()).toEqual([])
  })

  it('is allowed when appending, because the image is the evidence', async () => {
    const a = await flow().begin({ kind: 'window', windowId: 1 })
    if (!a.ok) throw new Error('setup')
    const first = await flow().commit(a.pending, 'the problem', { target: { kind: 'active' } })

    const b = await flow().begin({ kind: 'window', windowId: 1 })
    if (!b.ok) throw new Error('setup')
    const second = await flow().commit(b.pending, '', { target: { kind: 'active' } })

    expect(second.id).toBe(first.id)
    expect(second.captures).toHaveLength(2)
  })
})

describe('naming a new bundle', () => {
  it('uses the name given, and keeps the note on the capture', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')
    const bundle = await flow().commit(begun.pending, 'login button misaligned', {
      target: { kind: 'new', name: 'To do Bundle #4' },
    })
    expect(bundle.intent).toBe('To do Bundle #4')
    expect(bundle.captures[0]?.note).toBe('login button misaligned')
  })

  it('accepts a name with no note', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')
    const bundle = await flow().commit(begun.pending, '', { target: { kind: 'new', name: 'Backlog' } })
    expect(bundle.intent).toBe('Backlog')
  })

  it('refuses a new bundle with neither a name nor a note', async () => {
    const begun = await flow().begin({ kind: 'window', windowId: 1 })
    if (!begun.ok) throw new Error('setup')
    await expect(
      flow().commit(begun.pending, ' ', { target: { kind: 'new', name: ' ' } }),
    ).rejects.toThrow(/name/i)
  })
})
