import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * The native helper, anchored to the main bundle so one path resolves in both
 * `electron-vite dev` and inside the packaged asar.
 */
export function helperPath(): string {
  return join(here, '../../build/hive-helper')
}
