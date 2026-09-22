import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const read = (p: string) => readFile(resolve(here, '..', p), 'utf8')

describe('the Catalogue window can be moved', () => {
  // With the macOS title bar hidden, a window can only be dragged from a region
  // the page marks as draggable. Without one, the Catalogue could not be moved.
  it('marks a drag region when the title bar is hidden', async () => {
    const main = await read('packages/app/src/main/catalogue.ts')
    const page = await read('packages/app/src/renderer/Catalogue.tsx')

    if (/titleBarStyle:\s*'hidden/.test(main)) {
      expect(page).toMatch(/WebkitAppRegion:\s*'drag'/)
    }
  })
})
