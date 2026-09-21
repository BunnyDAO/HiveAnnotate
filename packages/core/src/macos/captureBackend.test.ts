import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, chmod, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MacCaptureBackend } from './captureBackend.ts'

let dir: string
let shots: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hive-capture-'))
  shots = join(dir, 'shots')
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** Stands in for /usr/sbin/screencapture so argument construction is assertable. */
async function fakeScreencapture(body: string): Promise<string> {
  const path = join(dir, 'screencapture')
  await writeFile(path, `#!/bin/sh\n${body}\n`)
  await chmod(path, 0o755)
  return path
}

/** A 1x1 PNG, written by the fake so the backend has real bytes to read. */
const PNG_1x1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

async function backend(opts: {
  screencapture: string
  permitted?: boolean
  argsFile?: string
}) {
  return new MacCaptureBackend({
    screencapturePath: opts.screencapture,
    isPermitted: async () => opts.permitted ?? true,
    scratchDir: shots,
  })
}

describe('argument construction', () => {
  it.each([
    [{ kind: 'window', windowId: 19860 } as const, ['-l', '19860']],
    [{ kind: 'screen' } as const, ['-x']],
    [{ kind: 'region', x: 12, y: 34, width: 56, height: 78 } as const, ['-R', '12,34,56,78']],
  ])('builds the right flags for %j', async (target, expected) => {
    const argsFile = join(dir, 'args.txt')
    const sc = await fakeScreencapture(
      `echo "$@" > ${argsFile}\nprintf '${PNG_1x1}' | base64 -d > "\${@: -1}"`,
    )

    const result = await (await backend({ screencapture: sc })).capture(target)

    expect(result.ok).toBe(true)
    const { readFile } = await import('node:fs/promises')
    const args = await readFile(argsFile, 'utf8')
    for (const token of expected) expect(args).toContain(token)
  })

  it('never opens Preview, Mail or writes to the Desktop', async () => {
    const argsFile = join(dir, 'args.txt')
    const sc = await fakeScreencapture(
      `echo "$@" > ${argsFile}\nprintf '${PNG_1x1}' | base64 -d > "\${@: -1}"`,
    )

    await (await backend({ screencapture: sc })).capture({ kind: 'screen' })

    const { readFile } = await import('node:fs/promises')
    const args = await readFile(argsFile, 'utf8')
    expect(args).not.toMatch(/\s-P\b/)
    expect(args).not.toMatch(/\s-M\b/)
    expect(args).not.toMatch(/\s-B\b/)
    expect(args).not.toContain('Desktop')
    // Silent, and no window shadow bleeding into the image.
    expect(args).toContain('-x')
  })

  it('writes only inside the scratch directory it was given', async () => {
    const sc = await fakeScreencapture(`printf '${PNG_1x1}' | base64 -d > "\${@: -1}"`)
    await (await backend({ screencapture: sc })).capture({ kind: 'screen' })
    expect(await readdir(shots)).toHaveLength(0)
  })
})

describe('the returned capture', () => {
  it('carries the image bytes and its real pixel dimensions', async () => {
    const sc = await fakeScreencapture(`printf '${PNG_1x1}' | base64 -d > "\${@: -1}"`)

    const result = await (await backend({ screencapture: sc })).capture({ kind: 'screen' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.image.length).toBeGreaterThan(0)
      expect(result.width).toBe(1)
      expect(result.height).toBe(1)
      expect(result.kind).toBe('screen')
    }
  })
})

describe('failure classification', () => {
  it('refuses before capturing when the permission is missing', async () => {
    const argsFile = join(dir, 'args.txt')
    const sc = await fakeScreencapture(`echo ran > ${argsFile}`)

    const result = await (
      await backend({ screencapture: sc, permitted: false })
    ).capture({ kind: 'screen' })

    expect(result).toMatchObject({ ok: false, reason: 'no-permission' })
    // Checked *before* invoking, so no image is produced at all.
    await expect(readdir(shots)).rejects.toThrow()
  })

  it('classifies a window that has gone away', async () => {
    const sc = await fakeScreencapture(`echo "could not create image from window" >&2\nexit 1`)

    const result = await (await backend({ screencapture: sc })).capture({
      kind: 'window',
      windowId: 1,
    })

    expect(result).toMatchObject({ ok: false, reason: 'stale-window-id' })
  })

  it('classifies a capture that produced no file', async () => {
    const sc = await fakeScreencapture(`exit 0`)

    const result = await (await backend({ screencapture: sc })).capture({ kind: 'screen' })

    expect(result).toMatchObject({ ok: false, reason: 'write-failure' })
  })

  it('classifies an unwritable destination', async () => {
    const sc = await fakeScreencapture(`printf '${PNG_1x1}' | base64 -d > "\${@: -1}"`)
    const be = new MacCaptureBackend({
      screencapturePath: sc,
      isPermitted: async () => true,
      scratchDir: '/proc/nope/cannot-create',
    })

    const result = await be.capture({ kind: 'screen' })

    expect(result).toMatchObject({ ok: false, reason: 'write-failure' })
  })

  it('keeps an unrecognised failure distinguishable rather than guessing', async () => {
    const sc = await fakeScreencapture(`echo "something else entirely" >&2\nexit 3`)

    const result = await (await backend({ screencapture: sc })).capture({ kind: 'screen' })

    expect(result).toMatchObject({ ok: false, reason: 'unknown' })
    if (!result.ok) expect(result.detail).toContain('something else')
  })
})
