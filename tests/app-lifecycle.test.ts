import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const main = resolve(here, '../packages/app/src/main/index.ts')

describe('the app stays running in the menu bar', () => {
  // Electron quits when every window has closed unless told otherwise. A
  // menu-bar app has no main window, so without this handler closing the
  // Catalogue quit the app. The line was deleted once by a patch that rewrote
  // the end of the file, and nothing noticed until the user did.
  it('keeps running when its last window closes', async () => {
    const source = await readFile(main, 'utf8')
    const handler = source.match(/app\.on\(\s*['"]window-all-closed['"]\s*,\s*\(\)\s*=>\s*\{([^}]*)\}\s*\)/)

    expect(handler, 'no window-all-closed handler registered').not.toBeNull()
    // Registered at the top level, where it always runs — not indented inside a
    // dev-only branch such as --self-test.
    const lineStart = source.lastIndexOf('\n', handler!.index) + 1
    expect(handler!.index, 'handler is nested, not top-level').toBe(lineStart)
    // And it must not quit.
    expect(handler![1]).not.toMatch(/quit|exit/)
  })
})
