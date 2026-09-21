/**
 * The entire on-disk format for Bundles.
 *
 * Deliberately plain filesystem: no Electron, no macOS APIs. The MCP server
 * (hive-v1-10) runs this in a bare Node process with Electron absent, and the
 * folder — not any database — is the source of truth.
 *
 *   <root>/<YYYY-MM-DD>-<slug>/
 *     manifest.json   structured truth
 *     001.png …       captures, in the order they were taken
 *     bundle.md       a rendering of the manifest, never a second source
 */

import { mkdir, readFile, writeFile, readdir, rm, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { slugify } from './slugify.ts'
import { renderBundleMarkdown } from './renderBundle.ts'

export type CaptureKind = 'window' | 'screen' | 'region'

export interface NewCapture {
  image: Uint8Array
  note: string
  kind: CaptureKind
  app?: string
  width: number
  height: number
  /** Injected rather than read from the clock, so ordering is testable. */
  takenAt: Date
}

export interface Capture {
  index: number
  file: string
  note: string
  kind: CaptureKind
  app?: string
  width: number
  height: number
  takenAt: string
}

export interface Bundle {
  id: string
  intent: string
  status: 'open' | 'closed'
  createdAt: string
  captures: Capture[]
}

interface Manifest extends Bundle {
  /** Monotonic. Never reuses a deleted capture's number. */
  nextIndex: number
}

const MANIFEST = 'manifest.json'
const MARKDOWN = 'bundle.md'

function isManifest(value: unknown): value is Manifest {
  if (typeof value !== 'object' || value === null) return false
  const m = value as Partial<Manifest>
  return (
    typeof m.id === 'string' &&
    typeof m.intent === 'string' &&
    (m.status === 'open' || m.status === 'closed') &&
    typeof m.createdAt === 'string' &&
    Array.isArray(m.captures) &&
    typeof m.nextIndex === 'number'
  )
}

function fileNameFor(index: number): string {
  return `${String(index).padStart(3, '0')}.png`
}

export interface BundleSummary {
  id: string
  intent: string
  status: 'open' | 'closed'
  createdAt: string
  captureCount: number
  /** True when the manifest could not be read. Surfaced, never hidden. */
  damaged?: true
}

export interface MoveResult {
  from: Bundle
  to: Bundle
}

/**
 * Detach a capture from its manifest. nextIndex is deliberately left alone so
 * the vacated number is never handed to a later capture.
 */
function takeCapture(manifest: Manifest, index: number, id: string): Capture {
  const at = manifest.captures.findIndex((c) => c.index === index)
  if (at === -1) throw new Error(`bundle ${id} has no capture ${index}`)
  return (manifest.captures.splice(at, 1) as [Capture])[0]
}

export class BundleStore {
  // A plain field, not a constructor parameter property: parameter properties
  // are not erasable syntax, so Node cannot strip them and this module would
  // stop loading in a bare Node process — which is exactly how the MCP server
  // (hive-v1-10) loads it. tsconfig's erasableSyntaxOnly keeps it that way.
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async createBundle(first: NewCapture): Promise<Bundle> {
    const id = await this.allocateId(first.note, first.takenAt)
    const dir = join(this.root, id)
    await mkdir(dir, { recursive: true })

    const manifest: Manifest = {
      id,
      // The first Note seeds the Intent. The user is never prompted for one.
      intent: first.note,
      status: 'open',
      createdAt: first.takenAt.toISOString(),
      captures: [],
      nextIndex: 1,
    }

    return this.addCapture(manifest, first)
  }

  async appendCapture(id: string, incoming: NewCapture): Promise<Bundle> {
    return this.addCapture(await this.readManifest(id), incoming)
  }

  async deleteCapture(id: string, index: number): Promise<Bundle> {
    const manifest = await this.readManifest(id)
    const removed = takeCapture(manifest, index, id)
    await rm(join(this.root, id, removed.file), { force: true })
    return this.writeManifest(manifest)
  }

  /** Move a Capture into an existing Bundle. The correction for a mis-filed capture. */
  async moveCapture(fromId: string, index: number, toId: string): Promise<MoveResult> {
    if (fromId === toId) throw new Error(`cannot move capture ${index} onto its own bundle ${fromId}`)

    const source = await this.readManifest(fromId)
    // Read the target before mutating anything, so a bad target leaves the
    // source exactly as it was.
    const target = await this.readManifest(toId)

    const capture = takeCapture(source, index, fromId)
    await this.transplant(capture, fromId, target)

    const from = await this.writeManifest(source)
    const to = await this.writeManifest(target)
    return { from, to }
  }

  /** Move a Capture out into a new Bundle seeded by that capture's Note. */
  async moveCaptureToNewBundle(fromId: string, index: number): Promise<MoveResult> {
    const source = await this.readManifest(fromId)
    const capture = takeCapture(source, index, fromId)

    const takenAt = new Date(capture.takenAt)
    const id = await this.allocateId(capture.note, takenAt)
    await mkdir(join(this.root, id), { recursive: true })

    const target: Manifest = {
      id,
      intent: capture.note,
      status: 'open',
      createdAt: capture.takenAt,
      captures: [],
      nextIndex: 1,
    }

    await this.transplant(capture, fromId, target)

    const from = await this.writeManifest(source)
    const to = await this.writeManifest(target)
    return { from, to }
  }

  /** Renumber a capture for its new bundle and move the image file across. */
  private async transplant(capture: Capture, fromId: string, target: Manifest): Promise<void> {
    const index = target.nextIndex
    const file = fileNameFor(index)

    await rename(join(this.root, fromId, capture.file), join(this.root, target.id, file))

    target.captures.push({ ...capture, index, file })
    target.nextIndex = index + 1
  }

  async getBundle(id: string): Promise<Bundle> {
    const { nextIndex: _nextIndex, ...bundle } = await this.readManifest(id)
    return bundle
  }

  /** Every Bundle, newest first. */
  async listBundles(): Promise<BundleSummary[]> {
    const summaries: BundleSummary[] = []

    for (const id of await this.existingIds()) {
      try {
        const manifest = await this.readManifest(id)
        summaries.push({
          id,
          intent: manifest.intent,
          status: manifest.status,
          createdAt: manifest.createdAt,
          captureCount: manifest.captures.length,
        })
      } catch {
        // A damaged bundle is still a bundle. Dropping it from the listing
        // would quietly lose the user's work; flag it instead.
        summaries.push({
          id,
          intent: id,
          status: 'open',
          createdAt: '',
          captureCount: 0,
          damaged: true,
        })
      }
    }

    return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async editNote(id: string, index: number, note: string): Promise<Bundle> {
    const manifest = await this.readManifest(id)
    const capture = manifest.captures.find((c) => c.index === index)
    if (!capture) throw new Error(`bundle ${id} has no capture ${index}`)

    // The Intent is seeded from the first Note once, at creation. Editing that
    // Note later does not re-seed it: by then the Intent is its own thing.
    capture.note = note
    return this.writeManifest(manifest)
  }

  async editIntent(id: string, intent: string): Promise<Bundle> {
    const manifest = await this.readManifest(id)
    // The id is never recomputed. Anything already handed to an agent still resolves.
    manifest.intent = intent
    return this.writeManifest(manifest)
  }

  async closeBundle(id: string): Promise<Bundle> {
    const manifest = await this.readManifest(id)
    manifest.status = 'closed'
    return this.writeManifest(manifest)
  }

  private async addCapture(manifest: Manifest, incoming: NewCapture): Promise<Bundle> {
    const index = manifest.nextIndex
    const file = fileNameFor(index)

    await writeFile(join(this.root, manifest.id, file), incoming.image)

    const capture: Capture = {
      index,
      file,
      note: incoming.note,
      kind: incoming.kind,
      ...(incoming.app === undefined ? {} : { app: incoming.app }),
      width: incoming.width,
      height: incoming.height,
      takenAt: incoming.takenAt.toISOString(),
    }

    manifest.captures.push(capture)
    manifest.nextIndex = index + 1

    return this.writeManifest(manifest)
  }

  private async allocateId(note: string, when: Date): Promise<string> {
    const datePart = when.toISOString().slice(0, 10)
    const base = `${datePart}-${slugify(note)}`

    const taken = new Set(await this.existingIds())
    if (!taken.has(base)) return base

    for (let n = 2; ; n++) {
      const candidate = `${base}-${n}`
      if (!taken.has(candidate)) return candidate
    }
  }

  private async existingIds(): Promise<string[]> {
    try {
      const entries = await readdir(this.root, { withFileTypes: true })
      return entries.filter((e) => e.isDirectory()).map((e) => e.name)
    } catch {
      return []
    }
  }

  private async readManifest(id: string): Promise<Manifest> {
    const path = join(this.root, id, MANIFEST)
    const raw = await readFile(path, 'utf8')

    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (cause) {
      // Never degrade a damaged manifest into an empty bundle: that would look
      // like the user's captures simply vanished.
      throw new Error(`bundle ${id} has an unreadable manifest`, { cause })
    }

    if (!isManifest(parsed)) throw new Error(`bundle ${id} has a malformed manifest`)
    return parsed
  }

  private async writeManifest(manifest: Manifest): Promise<Bundle> {
    const dir = join(this.root, manifest.id)
    await writeFile(join(dir, MANIFEST), JSON.stringify(manifest, null, 2) + '\n')

    const { nextIndex: _nextIndex, ...bundle } = manifest
    await writeFile(join(dir, MARKDOWN), renderBundleMarkdown(bundle))
    return bundle
  }
}
