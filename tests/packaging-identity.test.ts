import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { BUNDLE_ID, APP_NAME } from '../packages/core/src/index.ts'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const configPath = resolve(here, '../electron-builder.config.mjs')

describe('packaging identity cannot drift from core', () => {
  // hive-v1-03 (Developer ID signing) depends on the shipped bundle identifier
  // being exactly the one core records. If packaging ever hardcodes its own,
  // the Screen Recording grant silently breaks on the next build.
  it('takes its appId and product name from core', async () => {
    const config = (await import(pathToFileURL(configPath).href)).default
    expect(config.appId).toBe(BUNDLE_ID)
    expect(config.productName).toBe(APP_NAME)
  })

  it('is loadable by a bare node process, which is how electron-builder reads it', async () => {
    const script = `const c = (await import(${JSON.stringify(pathToFileURL(configPath).href)})).default
process.stdout.write(c.appId)`
    const { stdout } = await run(process.execPath, ['--input-type=module', '-e', script])
    expect(stdout).toBe(BUNDLE_ID)
  })
})
