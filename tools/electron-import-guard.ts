/**
 * The mechanical half of the core/Electron boundary.
 *
 * packages/core must stay importable in a plain Node process, because the MCP
 * server (hive-v1-10) runs as a standalone stdio subprocess with Electron
 * absent. The structural half of the guard is that packages/core's manifest
 * declares no Electron dependency; this is the half that catches a relative
 * import reaching sideways into Electron code.
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, extname, relative } from 'node:path'

export interface Violation {
  file: string
  specifier: string
}

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
const SKIP_DIRECTORIES = new Set(['node_modules', 'dist', 'out', 'release', '.git'])

const SPECIFIER_PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g, //            import … from 'x' / export … from 'x'
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g, // require('x')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g, //  await import('x')
  /\bimport\s+['"]([^'"]+)['"]/g, //            bare side-effect import 'x'
]

/**
 * Blank out comments so a line like `// never import from 'electron'` does not
 * trip the guard, while leaving string contents intact so offsets and quoting
 * stay intact for the specifier patterns.
 */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  type State = 'code' | 'line' | 'block' | 'single' | 'double' | 'template'
  let state: State = 'code'

  while (i < source.length) {
    const c = source[i]!
    const next = source[i + 1]

    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out += '  '; i += 2; continue }
      if (c === '/' && next === '*') { state = 'block'; out += '  '; i += 2; continue }
      if (c === "'") state = 'single'
      else if (c === '"') state = 'double'
      else if (c === '`') state = 'template'
      out += c; i++; continue
    }

    if (state === 'line') {
      if (c === '\n') { state = 'code'; out += c } else out += ' '
      i++; continue
    }

    if (state === 'block') {
      if (c === '*' && next === '/') { state = 'code'; out += '  '; i += 2; continue }
      out += c === '\n' ? c : ' '
      i++; continue
    }

    // Inside a string or template literal.
    if (c === '\\') { out += c + (next ?? ''); i += 2; continue }
    if ((state === 'single' && c === "'") || (state === 'double' && c === '"') || (state === 'template' && c === '`')) {
      state = 'code'
    }
    out += c; i++
  }

  return out
}

function isElectronSpecifier(specifier: string): boolean {
  if (specifier === 'electron') return true
  if (specifier.startsWith('electron/')) return true
  // Scoped Electron tooling: @electron/remote, @electron-toolkit/utils, …
  if (specifier.startsWith('@electron/') || specifier.startsWith('@electron-')) return true
  return false
}

/** Every Electron module specifier imported by this source, in source order. */
export function detectElectronImports(source: string): string[] {
  const code = stripComments(source)
  const found: string[] = []

  for (const pattern of SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code)) !== null) {
      const specifier = match[1]!
      if (isElectronSpecifier(specifier) && !found.includes(specifier)) found.push(specifier)
    }
  }

  return found
}

/** Walk a source tree and report every Electron import found in it. */
export async function scanTree(root: string): Promise<Violation[]> {
  const violations: Violation[] = []

  async function walk(dir: string): Promise<void> {
    // Deliberately not tolerant of a missing root: if the tree moved, the guard
    // must fail loudly rather than report a clean bill of health for nothing.
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) await walk(full)
        continue
      }
      if (!SOURCE_EXTENSIONS.has(extname(entry.name))) continue
      const source = await readFile(full, 'utf8')
      for (const specifier of detectElectronImports(source)) {
        violations.push({ file: relative(root, full), specifier })
      }
    }
  }

  await walk(root)
  return violations
}
