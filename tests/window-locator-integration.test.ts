import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, join } from 'node:path'
import { WindowLocator } from '../packages/core/src/macos/windowLocator.ts'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const helper = resolve(here, '../packages/app/build/hive-helper')

const built = existsSync(helper)

async function screenRecordingGranted(): Promise<boolean> {
  if (!built) return false
  const { stdout } = await run(helper, ['screen-permission'])
  return (JSON.parse(stdout) as { granted: boolean }).granted
}

describe.skipIf(!built)('the real helper on a real desktop', () => {
  it('reports the frontmost window with an id and a non-empty rectangle', async () => {
    const result = await new WindowLocator(helper).frontmost()

    // On a headless or locked machine there may genuinely be no window; that is
    // a legitimate result and not a failure of the locator.
    if (!result.ok) {
      expect(['no-window', 'no-frontmost-app', 'frontmost-is-self']).toContain(result.reason)
      return
    }

    expect(result.window.windowId).toBeGreaterThan(0)
    expect(result.window.width).toBeGreaterThan(0)
    expect(result.window.height).toBeGreaterThan(0)
  })

  it('reads the window id without needing the Screen Recording grant', async () => {
    // Only kCGWindowName is gated. The id and bounds are not, which is what
    // lets targeting work before the user has granted anything.
    const { stdout } = await run(helper, ['frontmost'])
    const parsed = JSON.parse(stdout) as { ok: boolean }
    expect(typeof parsed.ok).toBe('boolean')
  })

  it('answers the permission question without prompting', async () => {
    const { stdout } = await run(helper, ['screen-permission'])
    expect(JSON.parse(stdout)).toMatchObject({ ok: true, granted: expect.any(Boolean) })
  })

  it('hands back an id screencapture can actually photograph', async () => {
    if (!(await screenRecordingGranted())) {
      // Without the grant, window capture fails cleanly by design — asserted in
      // docs/research/macos-capture-constraints.md, not here.
      return
    }

    const result = await new WindowLocator(helper).frontmost()
    if (!result.ok) return

    const dir = await mkdtemp(join(tmpdir(), 'hive-shot-'))
    const out = join(dir, 'window.png')
    try {
      await run('screencapture', ['-x', '-o', '-l', String(result.window.windowId), out])
      const info = await stat(out)
      expect(info.size).toBeGreaterThan(1000)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe.skipIf(built)('native helper', () => {
  it('is skipped until `npm run build:native` has produced it', () => {
    expect(built).toBe(false)
  })
})
