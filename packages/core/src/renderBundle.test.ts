import { describe, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { renderBundleMarkdown } from './renderBundle.ts'
import type { Bundle } from './bundleStore.ts'

const here = dirname(fileURLToPath(import.meta.url))

const bundle: Bundle = {
  id: '2026-09-20-sidebar-collapses',
  intent: 'sidebar collapses when the modal opens',
  status: 'open',
  createdAt: '2026-09-20T14:22:00.000Z',
  captures: [
    {
      index: 1,
      file: '001.png',
      note: 'Modal open, sidebar at zero width.',
      kind: 'window',
      app: 'Safari',
      width: 1512,
      height: 982,
      takenAt: '2026-09-20T14:22:00.000Z',
    },
    {
      index: 2,
      file: '002.png',
      note: 'Console at the moment of collapse.',
      kind: 'region',
      width: 800,
      height: 420,
      takenAt: '2026-09-20T14:24:00.000Z',
    },
  ],
}

describe('bundle.md', () => {
  // bundle.md is what someone reads with `cat`, and what an agent reads when
  // no MCP server is involved. Its exact shape is part of the on-disk format,
  // so it is pinned to a hand-written golden file rather than a snapshot
  // generated from whatever the code currently does.
  it('matches the golden rendering', async () => {
    const golden = await readFile(resolve(here, '__fixtures__/bundle.golden.md'), 'utf8')
    expect(renderBundleMarkdown(bundle)).toBe(golden)
  })

  it('omits the app when a capture has none', () => {
    expect(renderBundleMarkdown(bundle)).toContain('## 002.png — region · 800×420')
  })

  it('renders an empty bundle without inventing content', () => {
    expect(renderBundleMarkdown({ ...bundle, captures: [] })).toBe(
      '# sidebar collapses when the modal opens\n',
    )
  })
})
