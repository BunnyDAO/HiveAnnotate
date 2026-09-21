import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { detectElectronImports, scanTree } from '../tools/electron-import-guard.ts'

const here = dirname(fileURLToPath(import.meta.url))
const coreSrc = resolve(here, '../packages/core/src')

describe('the guard itself detects Electron imports', () => {
  // A guard that silently detects nothing is worse than no guard: it would
  // pass forever while the boundary rotted underneath it. These cases prove
  // the detector actually fires before we trust it over packages/core.
  it.each([
    ["import { app } from 'electron'", 'electron'],
    ['import { app } from "electron"', 'electron'],
    ["import electron from 'electron'", 'electron'],
    ["import type { App } from 'electron'", 'electron'],
    ["export { app } from 'electron'", 'electron'],
    ["const { app } = require('electron')", 'electron'],
    ["await import('electron')", 'electron'],
    ["import { is } from '@electron-toolkit/utils'", '@electron-toolkit/utils'],
    ["import x from 'electron/main'", 'electron/main'],
  ])('flags %j', (source, expected) => {
    expect(detectElectronImports(source)).toContain(expected)
  })

  it.each([
    "import { readFile } from 'node:fs/promises'",
    "import { join } from 'node:path'",
    "// a comment mentioning electron",
    "const label = 'electron'",
    "import x from 'electronic-widgets'",
  ])('does not flag %j', (source) => {
    expect(detectElectronImports(source)).toEqual([])
  })
})

describe('packages/core is importable without Electron', () => {
  it('has no Electron import anywhere in its source', async () => {
    const violations = await scanTree(coreSrc)
    expect(violations).toEqual([])
  })
})
