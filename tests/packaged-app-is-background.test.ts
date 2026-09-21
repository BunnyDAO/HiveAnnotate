import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { BUNDLE_ID, APP_NAME } from '../packages/core/src/index.ts'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const plist = resolve(
  here,
  `../packages/app/release/mac-arm64/${APP_NAME}.app/Contents/Info.plist`,
)

// Packaging takes minutes, so this asserts against the artefact when one is
// present rather than building it. `npm run pack` produces it.
const packaged = existsSync(plist)

describe.skipIf(!packaged)('the packaged app is a menu-bar background app', () => {
  async function info(): Promise<Record<string, unknown>> {
    const { stdout } = await run('plutil', ['-convert', 'json', '-o', '-', plist])
    return JSON.parse(stdout) as Record<string, unknown>
  }

  // LSUIElement is what keeps the app out of the dock and out of Cmd-Tab.
  // Without it the product is wrong: there is no main window to show.
  it('declares LSUIElement', async () => {
    expect(await info()).toMatchObject({ LSUIElement: true })
  })

  it('ships the bundle identifier core records', async () => {
    expect(await info()).toMatchObject({ CFBundleIdentifier: BUNDLE_ID })
  })
})

describe.skipIf(packaged)('packaging check', () => {
  it('is skipped until `npm run pack` has produced an .app', () => {
    expect(packaged).toBe(false)
  })
})
