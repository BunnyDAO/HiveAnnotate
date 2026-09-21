import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

const run = promisify(execFile)

/**
 * The fraction of an image's pixels that are NOT the given colour.
 *
 * Used over a solid backdrop the test puts on screen itself, so the answer does
 * not depend on whatever else happens to be on the user's display. (A first
 * attempt counted "honey-coloured" pixels on the live screen and could not tell
 * the overlay's orange from orange that was genuinely there.)
 *
 * Decodes via `sips` to BMP: uncompressed, no decoder dependency. Dev/test only.
 */
export async function offColourFraction(
  png: string,
  target: { r: number; g: number; b: number },
  tolerance = 28,
): Promise<number> {
  const bmp = join(tmpdir(), `hive-probe-${randomUUID()}.bmp`)
  try {
    await run('sips', ['-s', 'format', 'bmp', png, '--out', bmp])
    const buf = await readFile(bmp)

    const offset = buf.readUInt32LE(10)
    const width = buf.readInt32LE(18)
    const height = Math.abs(buf.readInt32LE(22))
    const bytesPerPixel = buf.readUInt16LE(28) / 8
    const rowStride = Math.ceil((width * bytesPerPixel) / 4) * 4

    let off = 0
    let total = 0
    for (let y = 0; y < height; y += 2) {
      const row = offset + y * rowStride
      for (let x = 0; x < width; x += 2) {
        const p = row + x * bytesPerPixel
        const b = buf[p]!
        const g = buf[p + 1]!
        const r = buf[p + 2]!
        total++
        const near =
          Math.abs(r - target.r) <= tolerance &&
          Math.abs(g - target.g) <= tolerance &&
          Math.abs(b - target.b) <= tolerance
        if (!near) off++
      }
    }
    return total === 0 ? 0 : off / total
  } finally {
    await rm(bmp, { force: true })
  }
}
