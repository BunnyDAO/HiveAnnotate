/** Reads a PNG's pixel dimensions from its IHDR chunk. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  // 8-byte signature, then a 4-byte length and the "IHDR" tag, then width and
  // height as big-endian 32-bit integers.
  if (bytes.length < 24) return null
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < signature.length; i++) if (bytes[i] !== signature[i]) return null
  if (String.fromCharCode(...bytes.slice(12, 16)) !== 'IHDR') return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  return { width: view.getUint32(16), height: view.getUint32(20) }
}
