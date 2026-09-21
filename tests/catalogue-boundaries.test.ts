import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { detectElectronImports } from '../tools/electron-import-guard.ts'

const here = dirname(fileURLToPath(import.meta.url))
const catalogue = resolve(here, '../packages/app/src/main/catalogue.ts')

describe('the Catalogue keeps its hands off', () => {
  it('never touches the filesystem directly', async () => {
    const source = await readFile(catalogue, 'utf8')

    // Every mutation must go through BundleStore, which owns the format and is
    // the only thing that keeps manifest.json and bundle.md in step. A stray
    // write here would desynchronise them silently.
    expect(source).not.toMatch(/from ['"]node:fs/)
    expect(source).not.toMatch(/require\(['"]node:fs/)
  })

  it('never reaches for a specific handoff destination', async () => {
    const source = await readFile(catalogue, 'utf8')

    // Destinations arrive through the registry. Naming clipboard or shell here
    // would be the first crack in the agnostic claim.
    for (const forbidden of ['clipboard', 'shell']) {
      expect(source.toLowerCase()).not.toContain(`electron').${forbidden}`)
      expect(source).not.toMatch(new RegExp(`\\b${forbidden}\\.(write|open)`, 'i'))
    }
  })

  it('does import Electron, unlike core — it is app code', async () => {
    const source = await readFile(catalogue, 'utf8')
    expect(detectElectronImports(source)).toContain('electron')
  })
})
