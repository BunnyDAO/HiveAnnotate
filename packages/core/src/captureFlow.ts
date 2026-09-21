/**
 * Capture, annotate, file — the two-second path, minus the pixels on screen.
 *
 * This is everything the annotation bar does, with no window, no Electron and
 * no React, so each key's behaviour is assertable. The bar itself is then just
 * a surface: it renders `destination` and calls `commit`.
 */

import { join } from 'node:path'
import { decideDestination, STALE_AFTER_MS } from './activeBundlePolicy.ts'
import type { CaptureDestination } from './activeBundlePolicy.ts'
import { ActiveBundleTracker } from './activeBundleTracker.ts'
import { BundleStore } from './bundleStore.ts'
import type { Bundle } from './bundleStore.ts'
import { AdapterRegistry, bundlePointer } from './handoff.ts'
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
  | { kind: 'new' }
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
  bundleRoot?: string
}

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

    // A new Bundle takes its name and its Intent from this note. Without one
    // there is nothing to call it and nothing for an agent to act on, so it is
    // refused rather than filed as "untitled". Appending is different: the
    // image is the evidence and the Bundle already has an Intent.
    if (!bundleId && !trimmed) {
      throw new Error('a new bundle needs a note — it becomes the bundle’s name and intent')
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
      : await this.deps.store.createBundle(capture)

    await this.deps.tracker.record(bundle.id, pending.takenAt)

    if (options.copyPointer) await this.copyPointer(bundle)

    return bundle
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
        directory: join(this.deps.bundleRoot ?? '', bundle.id),
        pointer: bundlePointer(bundle.id),
      })
    } catch {
      // A failed handoff costs the handoff, never the capture. The bar can
      // surface it; the work is already safely on disk.
    }
  }
}
