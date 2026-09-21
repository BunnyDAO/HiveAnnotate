// Generates the menu-bar template icons. macOS template images are pure black
// with alpha; the system recolours them for light/dark menu bars.
// Glyph: four corner brackets — the selection-region motif.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

function crc32(buf) {
  let c, crc = 0xffffffff
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = c ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function png(size, alphaAt) {
  const raw = Buffer.alloc(size * (size * 4 + 1))
  let p = 0
  for (let y = 0; y < size; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < size; x++) {
      raw[p++] = 0 // R
      raw[p++] = 0 // G
      raw[p++] = 0 // B
      raw[p++] = alphaAt(x, y, size) // A
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// Corner brackets, scaled off a 16pt design grid.
function bracketAlpha(x, y, size) {
  const u = size / 16
  const inset = 2 * u
  const thickness = Math.max(1, Math.round(1.5 * u))
  const arm = 5 * u
  const max = size - inset

  const nearLeft = x >= inset && x < inset + thickness
  const nearRight = x < max && x >= max - thickness
  const nearTop = y >= inset && y < inset + thickness
  const nearBottom = y < max && y >= max - thickness

  const inTopArm = y >= inset && y < inset + arm
  const inBottomArm = y < max && y >= max - arm
  const inLeftArm = x >= inset && x < inset + arm
  const inRightArm = x < max && x >= max - arm

  const vertical = (nearLeft || nearRight) && (inTopArm || inBottomArm)
  const horizontal = (nearTop || nearBottom) && (inLeftArm || inRightArm)
  return vertical || horizontal ? 255 : 0
}

const out = resolve(here, '../packages/app/build')
mkdirSync(out, { recursive: true })
writeFileSync(resolve(out, 'trayTemplate.png'), png(16, bracketAlpha))
writeFileSync(resolve(out, 'trayTemplate@2x.png'), png(32, bracketAlpha))
console.log('wrote packages/app/build/trayTemplate.png and @2x')
