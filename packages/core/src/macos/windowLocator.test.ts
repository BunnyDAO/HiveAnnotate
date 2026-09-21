import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WindowLocator } from './windowLocator.ts'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hive-locator-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

/** A stand-in for the native helper, so the wrapper is testable off a real desktop. */
async function fakeHelper(body: string): Promise<string> {
  const path = join(dir, 'hive-helper')
  await writeFile(path, `#!/bin/sh\n${body}\n`)
  await chmod(path, 0o755)
  return path
}

describe('locating the frontmost window', () => {
  it('returns the window id and bounds', async () => {
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":63611,"app":"Google Chrome","windows":[{"windowId":19860,"x":0,"y":39,"width":1800,"height":1130}]}'`,
    )

    const result = await new WindowLocator(helper).frontmost()

    expect(result).toEqual({
      ok: true,
      window: {
        windowId: 19860,
        pid: 63611,
        app: 'Google Chrome',
        x: 0,
        y: 39,
        width: 1800,
        height: 1130,
      },
    })
  })

  it('excludes our own process so the overlay never captures itself', async () => {
    const helper = await fakeHelper(`echo "{\\"ok\\":false,\\"reason\\":\\"args:$*\\"}"`)

    await new WindowLocator(helper, { excludePid: 4242 }).frontmost()
    const result = await new WindowLocator(helper, { excludePid: 4242 }).frontmost()

    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reason).toContain('--exclude-pid 4242')
  })

  it.each([
    ['no-window', 'the frontmost app has no ordinary window'],
    ['no-frontmost-app', 'nothing is frontmost'],
    ['frontmost-is-self', 'our own overlay is frontmost'],
  ])('reports %s as a result, not an exception (%s)', async (reason) => {
    const helper = await fakeHelper(`echo '{"ok":false,"reason":"${reason}"}'`)

    const result = await new WindowLocator(helper).frontmost()

    expect(result).toEqual({ ok: false, reason })
  })

  it('reports a helper that cannot run, rather than throwing', async () => {
    const result = await new WindowLocator(join(dir, 'does-not-exist')).frontmost()
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reason).toMatch(/helper/)
  })

  it('reports unreadable helper output rather than crashing the capture path', async () => {
    const helper = await fakeHelper(`echo 'not json'`)
    const result = await new WindowLocator(helper).frontmost()
    expect(result).toMatchObject({ ok: false })
    if (!result.ok) expect(result.reason).toMatch(/unreadable|parse/i)
  })

  it('rejects a window with zero area instead of handing back an empty capture target', async () => {
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":2,"app":"X","windows":[{"windowId":1,"x":0,"y":0,"width":0,"height":100}]}'`,
    )
    const result = await new WindowLocator(helper).frontmost()
    expect(result).toMatchObject({ ok: false })
  })

  it('skips a status-bubble strip in front of the real window', async () => {
    // Observed in the wild: Chrome's link-preview strip is 1772x22, sits at
    // layer 0, and comes back *ahead* of the browser window. Capturing it
    // instead would be silently wrong — a 22px sliver where a screenshot
    // should be.
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":1,"app":"Google Chrome","windows":[` +
        `{"windowId":23820,"x":-1,"y":1148,"width":1772,"height":22},` +
        `{"windowId":19860,"x":0,"y":39,"width":1800,"height":1130}]}'`,
    )

    const result = await new WindowLocator(helper).frontmost()

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.window.windowId).toBe(19860)
  })

  it('takes the frontmost window when several are substantial', async () => {
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":1,"app":"X","windows":[` +
        `{"windowId":11,"x":0,"y":0,"width":900,"height":600},` +
        `{"windowId":22,"x":0,"y":0,"width":1800,"height":1130}]}'`,
    )
    const result = await new WindowLocator(helper).frontmost()
    expect(result.ok && result.window.windowId).toBe(11)
  })

  it('falls back to the largest when the app only has small windows', async () => {
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":1,"app":"X","windows":[` +
        `{"windowId":11,"x":0,"y":0,"width":80,"height":40},` +
        `{"windowId":22,"x":0,"y":0,"width":150,"height":100}]}'`,
    )
    const result = await new WindowLocator(helper).frontmost()
    expect(result.ok && result.window.windowId).toBe(22)
  })

  it('reports no-window when the app has none at all', async () => {
    const helper = await fakeHelper(`echo '{"ok":true,"pid":1,"app":"X","windows":[]}'`)
    expect(await new WindowLocator(helper).frontmost()).toEqual({ ok: false, reason: 'no-window' })
  })
})

describe('the rectangle handed to screencapture', () => {
  it('is the window bounds in the order -R expects', async () => {
    const helper = await fakeHelper(
      `echo '{"ok":true,"pid":2,"app":"X","windows":[{"windowId":1,"x":12,"y":34,"width":56,"height":78}]}'`,
    )
    const result = await new WindowLocator(helper).frontmost()

    expect(result.ok).toBe(true)
    if (result.ok) {
      const { x, y, width, height } = result.window
      // Quartz global display coordinates, origin top-left of the main display
      // — the same space `screencapture -R x,y,w,h` expects.
      expect([x, y, width, height].join(',')).toBe('12,34,56,78')
    }
  })
})
