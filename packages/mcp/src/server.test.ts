import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, access, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { BundleStore } from '@hiveannotate/core'
import type { NewCapture } from '@hiveannotate/core'

const here = dirname(fileURLToPath(import.meta.url))
const bin = resolve(here, 'bin.ts')

let home: string
let store: BundleStore
let client: Client

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

/**
 * Spawns the real server as a bare Node subprocess. Running it in-process
 * would prove nothing: the whole point of this package is that it works with
 * Electron absent and HiveAnnotate not running.
 */
async function connect(): Promise<Client> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [bin],
    env: { PATH: process.env['PATH'] ?? '', HIVEANNOTATE_HOME: home },
    // An MCP client spawns its servers from wherever it happens to be, not
    // from this repo. Running from a foreign cwd keeps that honest.
    cwd: tmpdir(),
  })
  const c = new Client({ name: 'test', version: '0' })
  await c.connect(transport)
  return c
}

beforeEach(async () => {
  home = await mkdtemp(join(tmpdir(), 'hive-mcp-'))
  store = new BundleStore(join(home, 'bundles'))
})

afterEach(async () => {
  await client?.close()
  await rm(home, { recursive: true, force: true })
})

describe('the server over stdio', () => {
  it('starts in a bare node process and advertises its tools', async () => {
    client = await connect()

    const names = (await client.listTools()).tools.map((t) => t.name).sort()

    expect(names).toEqual(['close_bundle', 'get_bundle', 'list_bundles'])
  })

  it('lists bundles newest first', async () => {
    await store.createBundle(capture({ note: 'oldest', takenAt: new Date('2026-09-18T09:00:00Z') }))
    await store.createBundle(capture({ note: 'newest', takenAt: new Date('2026-09-20T09:00:00Z') }))

    client = await connect()
    const result = await client.callTool({ name: 'list_bundles', arguments: {} })

    const bundles = JSON.parse((result.content as { text: string }[])[0]!.text) as {
      intent: string
    }[]
    expect(bundles.map((b) => b.intent)).toEqual(['newest', 'oldest'])
  })

  it('reports an empty catalogue without erroring', async () => {
    client = await connect()
    const result = await client.callTool({ name: 'list_bundles', arguments: {} })
    expect(JSON.parse((result.content as { text: string }[])[0]!.text)).toEqual([])
  })
})

function payload(result: unknown): unknown {
  return JSON.parse(((result as { content: { text: string }[] }).content)[0]!.text)
}

describe('get_bundle', () => {
  it('hands back absolute paths that actually exist', async () => {
    const { id } = await store.createBundle(capture({ note: 'broken sidebar' }))
    await store.appendCapture(id, capture({ note: 'the console', kind: 'region' }))

    client = await connect()
    const bundle = payload(await client.callTool({ name: 'get_bundle', arguments: { id } })) as {
      intent: string
      captures: { path: string; note: string }[]
    }

    expect(bundle.intent).toBe('broken sidebar')
    expect(bundle.captures.map((c) => c.note)).toEqual(['broken sidebar', 'the console'])

    for (const c of bundle.captures) {
      expect(isAbsolute(c.path)).toBe(true)
      // The path is the whole point: an agent reads the image from it directly.
      await expect(access(c.path)).resolves.toBeUndefined()
      expect((await readFile(c.path)).length).toBeGreaterThan(0)
    }
  })

  it('reports an unknown id as an error without killing the server', async () => {
    client = await connect()

    const result = await client.callTool({ name: 'get_bundle', arguments: { id: 'no-such-bundle' } })
    expect(result.isError).toBe(true)

    // Still alive and usable afterwards.
    expect(payload(await client.callTool({ name: 'list_bundles', arguments: {} }))).toEqual([])
  })
})

describe('close_bundle', () => {
  it('drops the bundle from the listing', async () => {
    const open = await store.createBundle(capture({ note: 'still open', takenAt: new Date('2026-09-20T09:00:00Z') }))
    const done = await store.createBundle(capture({ note: 'finished', takenAt: new Date('2026-09-20T10:00:00Z') }))

    client = await connect()
    await client.callTool({ name: 'close_bundle', arguments: { id: done.id } })

    const listed = payload(await client.callTool({ name: 'list_bundles', arguments: {} })) as { id: string }[]
    expect(listed.map((b) => b.id)).toEqual([open.id])
  })

  it('is durable across a server restart', async () => {
    const { id } = await store.createBundle(capture())

    client = await connect()
    await client.callTool({ name: 'close_bundle', arguments: { id } })
    await client.close()

    client = await connect()
    expect(payload(await client.callTool({ name: 'list_bundles', arguments: {} }))).toEqual([])
    // And visible to anything else reading the folder — the Catalogue included.
    expect((await store.getBundle(id)).status).toBe('closed')
  })
})

describe('independence from the app', () => {
  it('serves bundles the app wrote while the server was already running', async () => {
    client = await connect()
    expect(payload(await client.callTool({ name: 'list_bundles', arguments: {} }))).toEqual([])

    // The app captures something *after* the agent's session started.
    const { id } = await store.createBundle(capture({ note: 'captured mid-session' }))

    const listed = payload(await client.callTool({ name: 'list_bundles', arguments: {} })) as { id: string }[]
    expect(listed.map((b) => b.id)).toEqual([id])
  })

  it('runs with no Electron on the module path at all', async () => {
    client = await connect()
    const { tools } = await client.listTools()
    // The subprocess was spawned with a bare env and resolved nothing from
    // Electron; reaching this line at all is the assertion.
    expect(tools).not.toHaveLength(0)
  })
})
