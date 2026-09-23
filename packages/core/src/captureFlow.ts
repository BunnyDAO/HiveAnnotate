/**
 * Capture, annotate, file — the two-second path, minus the pixels on screen.
 *
 * This is everything the annotation bar does, with no window, no Electron and
 * no React, so each key's behaviour is assertable. The bar itself is then just
 * a surface: it renders `destination` and calls `commit`.
 */

import { join } from 'node:path'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { decideDestination, STALE_AFTER_MS } from './activeBundlePolicy.ts'
import type { CaptureDestination } from './activeBundlePolicy.ts'
import { ActiveBundleTracker } from './activeBundleTracker.ts'
import { BundleStore } from './bundleStore.ts'
import type { Bundle } from './bundleStore.ts'
import { AdapterRegistry, bundlePointer } from './handoff.ts'
import { quickPrompt } from './quickPrompt.ts'
import { slugify } from './slugify.ts'
import type { CaptureBackend, CaptureFailure, CaptureTarget } from './macos/captureBackend.ts'

export interface PendingCapture {
  image: Uint8Array
  width: number
  height: number
  kind: CaptureTarget['kind']
  app?: string
  takenAt: Date
  /** What would happen on ⏎, so the bar can say so before the user commits. */
  destination: CaptureDestination
}

export type BeginResult =
  | { ok: true; pending: PendingCapture }
  | { ok: false; reason: CaptureFailure; detail?: string }

export type CommitTarget =
  | { kind: 'active' }
  /** A new bundle, optionally with an explicit name (otherwise the note names it). */
  | { kind: 'new'; name?: string }
  | { kind: 'bundle'; id: string }

export interface CommitOptions {
  target: CommitTarget
  copyPointer?: boolean
}

export interface CaptureFlowDeps {
  backend: CaptureBackend
  store: BundleStore
  tracker: ActiveBundleTracker
  registry: AdapterRegistry
  now: () => Date
  staleAfterMs?: number
  /**
   * Absolute. The copied pointer names a real path an agent can open, so a
   * relative or missing root would produce a pointer that leads nowhere.
   */
  bundleRoot: string
  /**
   * Where "copy and go" screenshots land: captures the user wanted to show an
   * agent but not keep. Absolute, and never inside `bundleRoot` — anything
   * listing bundles would otherwise read one as a bundle.
   */
  scratchRoot: string
}

/** How long a "copy and go" screenshot survives before it is cleared out. */
export const SCRATCH_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class CaptureFlow {
  private readonly deps: CaptureFlowDeps

  constructor(deps: CaptureFlowDeps) {
    this.deps = deps
  }

  async begin(target: CaptureTarget, app?: string): Promise<BeginResult> {
    const shot = await this.deps.backend.capture(target)
    if (!shot.ok) return { ok: false, reason: shot.reason, detail: shot.detail }

    const destination = decideDestination(
      await this.deps.tracker.current(),
      this.deps.now(),
      this.deps.staleAfterMs ?? STALE_AFTER_MS,
    )

    return {
      ok: true,
      pending: {
        image: shot.image,
        width: shot.width,
        height: shot.height,
        kind: shot.kind,
        ...(app === undefined ? {} : { app }),
        takenAt: this.deps.now(),
        destination,
      },
    }
  }

  async commit(pending: PendingCapture, note: string, options: CommitOptions): Promise<Bundle> {
    const trimmed = note.trim()
    const bundleId = await this.resolveBundle(pending, options.target)

    const name = options.target.kind === 'new' ? options.target.name?.trim() ?? '' : ''

    // A new Bundle needs a name — given explicitly, or taken from the note.
    // Without either there is nothing to call it and nothing for an agent to
    // act on, so it is refused rather than filed as "untitled". Appending is
    // different: the image is the evidence and the Bundle already has a name.
    if (!bundleId && !trimmed && !name) {
      throw new Error('a new bundle needs a name')
    }

    const capture = {
      image: pending.image,
      note: trimmed,
      kind: pending.kind,
      ...(pending.app === undefined ? {} : { app: pending.app }),
      width: pending.width,
      height: pending.height,
      takenAt: pending.takenAt,
    }

    const bundle = bundleId
      ? await this.deps.store.appendCapture(bundleId, capture)
      : await this.deps.store.createBundle(capture, name ? { name } : {})

    await this.deps.tracker.record(bundle.id, pending.takenAt)

    if (options.copyPointer) await this.copyPointer(bundle)

    return bundle
  }

  /**
   * "Copy and go": write the screenshot somewhere an agent can read it and
   * return the line to paste, without filing anything.
   *
   * A terminal cannot paste an image, so the picture has to be a file. It is
   * not a Bundle: no manifest, no bundle.md, nothing in the Catalogue, and the
   * active Bundle is untouched — this capture was never part of a problem the
   * user is keeping. Old ones are cleared out as new ones arrive.
   */
  async stash(pending: PendingCapture, note: string): Promise<{ path: string; prompt: string }> {
    const root = this.deps.scratchRoot
    await mkdir(root, { recursive: true })
    await this.clearOldScratch(root)

    const stamp = pending.takenAt.toISOString().slice(0, 16).replace(/[-:]/g, '').replace('T', '-')
    const slug = slugify(note) || 'capture'
    // A second capture in the same minute must not overwrite the first.
    let path = join(root, `${stamp}-${slug}.png`)
    for (let n = 2; await exists(path); n++) path = join(root, `${stamp}-${slug}-${n}.png`)

    await writeFile(path, pending.image)
    return { path, prompt: quickPrompt(note, path) }
  }

  private async clearOldScratch(root: string): Promise<void> {
    const cutoff = this.deps.now().getTime() - SCRATCH_TTL_MS
    const names = await readdir(root).catch(() => [] as string[])
    await Promise.all(
      names.map(async (name) => {
        const path = join(root, name)
        const info = await stat(path).catch(() => null)
        if (info?.isFile() && info.mtimeMs < cutoff) await rm(path, { force: true })
      }),
    )
  }

  /** ⎋ — nothing is written, and the active bundle is left as it was. */
  async discard(_pending: PendingCapture): Promise<void> {
    // Intentionally empty: begin() writes nothing. Discarding is the absence of
    // a commit, not an undo — which is why a failed capture can never orphan
    // a bundle.
  }

  private async resolveBundle(
    pending: PendingCapture,
    target: CommitTarget,
  ): Promise<string | null> {
    if (target.kind === 'new') return null
    if (target.kind === 'bundle') return target.id
    return pending.destination.kind === 'append' ? pending.destination.bundleId : null
  }

  private async copyPointer(bundle: Bundle): Promise<void> {
    try {
      await this.deps.registry.handoff('clipboard', {
        bundle,
        directory: join(this.deps.bundleRoot, bundle.id),
        pointer: bundlePointer(bundle.id, join(this.deps.bundleRoot, bundle.id)),
      })
    } catch {
      // A failed handoff costs the handoff, never the capture. The bar can
      // surface it; the work is already safely on disk.
    }
  }
}

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false)
}
