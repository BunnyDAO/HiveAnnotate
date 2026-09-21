import { describe, it, expect } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))
const coreEntry = pathToFileURL(resolve(here, '../packages/core/src/index.ts')).href

describe('core runs outside Electron', () => {
  // The static guard proves core does not *import* Electron. This proves core
  // actually *executes* in a plain Node process — which is what the MCP server
  // (hive-v1-10) does for a living. Spawning a real subprocess is the point:
  // running it inside vitest would prove nothing about the outside world.
  it('is importable and usable from a bare node process', async () => {
    const script = `import { BUNDLE_ID, APP_NAME } from ${JSON.stringify(coreEntry)}
process.stdout.write(JSON.stringify({ BUNDLE_ID, APP_NAME }))`

    const { stdout } = await run(process.execPath, ['--input-type=module', '-e', script])

    expect(JSON.parse(stdout)).toEqual({
      BUNDLE_ID: 'io.hiveop.hiveannotate',
      APP_NAME: 'HiveAnnotate',
    })
  })
})
