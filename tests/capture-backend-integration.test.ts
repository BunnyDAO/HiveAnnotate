import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, readdir } from 'node:fs/promises'
import { tmpdir, homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { MacCaptureBackend } from '../packages/core/src/macos/captureBackend.ts'
import { WindowLocator } from '../packages/core/src/macos/windowLocator.ts'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const helper = resolve(here, '../packages/app/build/hive-helper')
const built = existsSync(helper)

async function granted(): Promise<boolean> {
  if (!built) return false
  const { stdout } = await run(helper, ['screen-permission'])
  return (JSON.parse(stdout) as { granted: boolean }).granted
}

async function realBackend(scratch: string): Promise<MacCaptureBackend> {
  return new MacCaptureBackend({
    screencapturePath: '/usr/sbin/screencapture',
    isPermitted: granted,
    scratchDir: scratch,
  })
}

describe.skipIf(!built)('capturing for real', () => {
  it('returns a region at true Retina resolution', async () => {
    if (!(await granted())) return

    const dir = await mkdtemp(join(tmpdir(), 'hive-cap-'))
    try {
      const result = await (
        await realBackend(dir)
      ).capture({ kind: 'region', x: 0, y: 0, width: 200, height: 100 })

      expect(result.ok).toBe(true)
      if (!result.ok) return

      // On a Retina display the pixel dimensions are a whole-number multiple of
      // the requested point size. Asserting the ratio rather than "2" keeps this
      // honest on a non-Retina display.
      expect(result.width % 200).toBe(0)
      expect(result.height % 100).toBe(0)
      expect(result.width / 200).toBe(result.height / 100)
      expect(result.width).toBeGreaterThanOrEqual(200)
      expect(result.image.length).toBeGreaterThan(1000)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('captures the frontmost window by id', async () => {
    if (!(await granted())) return
    const located = await new WindowLocator(helper).frontmost()
    if (!located.ok) return

    const dir = await mkdtemp(join(tmpdir(), 'hive-cap-'))
    try {
      const result = await (
        await realBackend(dir)
      ).capture({ kind: 'window', windowId: located.window.windowId })

      expect(result.ok).toBe(true)
      if (result.ok) expect(result.image.length).toBeGreaterThan(1000)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('leaves nothing behind in the scratch directory or on the Desktop', async () => {
    if (!(await granted())) return

    const dir = await mkdtemp(join(tmpdir(), 'hive-cap-'))
    const desktop = join(homedir(), 'Desktop')
    const before = existsSync(desktop) ? await readdir(desktop) : []
    try {
      await (await realBackend(dir)).capture({ kind: 'screen' })

      // The bytes come back in memory; the temp file is removed.
      expect(await readdir(dir)).toEqual([])
      const after = existsSync(desktop) ? await readdir(desktop) : []
      expect(after).toEqual(before)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('reports a window that no longer exists rather than writing a mystery image', async () => {
    if (!(await granted())) return

    const dir = await mkdtemp(join(tmpdir(), 'hive-cap-'))
    try {
      const result = await (
        await realBackend(dir)
      ).capture({ kind: 'window', windowId: 999999999 })

      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.reason).toBe('stale-window-id')
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
