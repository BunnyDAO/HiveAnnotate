import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

/**
 * The native helper, anchored to the main bundle so one path resolves in both
 * `electron-vite dev` and the packaged app.
 *
 * In the packaged app the helper is unpacked beside the asar rather than
 * inside it (macOS will not execute a binary from within an archive), so the
 * path is rewritten to the `.unpacked` twin.
 */
export function helperPath(): string {
  return join(here, '../../build/hive-helper').replace(
    `app.asar${'/'}`,
    `app.asar.unpacked${'/'}`,
  )
}
