import { ipcMain, shell } from 'electron'
import {
  ActiveBundleTracker,
  AdapterRegistry,
  BundleStore,
  CaptureFlow,
  MacCaptureBackend,
  WindowLocator,
  defaultActiveBundleRecord,
  defaultBundleRoot,
  explainFailure,
} from '@hiveannotate/core'
import type { CaptureIntent, CaptureTarget, PendingCapture } from '@hiveannotate/core'
import { helperPath } from './helper.ts'
import { Overlay } from './overlay.ts'
import { RegionOverlay } from './regionOverlay.ts'
import type { Rect } from './regionOverlay.ts'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const run = promisify(execFile)

/**
 * Binds a capture intent to the overlay: take the picture, work out where it
 * would go, show the bar, and file what the user types.
 */
export class CaptureSession {
  /**
   * Dev-only failure injection, used by --self-test to exercise the failure
   * paths. Never set in normal operation.
   */
  static forceFailure: 'no-permission' | 'stale-window-id' | 'write-failure' | 'unknown' | null = null

  private readonly overlay = new Overlay()
  private readonly regionOverlay = new RegionOverlay()
  private readonly store: BundleStore
  private readonly flow: CaptureFlow
  private readonly locator = new WindowLocator(helperPath(), { excludePid: process.pid })
  private pending: PendingCapture | null = null
  private bundleIds: string[] = []
  /** Kept so a retry aims at the same thing, with the user's note intact. */
  private lastTarget: CaptureTarget | null = null

  constructor(registry: AdapterRegistry) {
    const root = defaultBundleRoot()
    this.store = new BundleStore(root)

    const tracker = new ActiveBundleTracker(defaultActiveBundleRecord(), {
      bundleExists: async (id) => this.store.getBundle(id).then(() => true, () => false),
    })

    const real = new MacCaptureBackend({
        screencapturePath: '/usr/sbin/screencapture',
        isPermitted: async () => {
          const { stdout } = await run(helperPath(), ['screen-permission'])
          return (JSON.parse(stdout) as { granted: boolean }).granted
        },
        scratchDir: join(tmpdir(), 'hiveannotate'),
    })

    this.flow = new CaptureFlow({
      backend: {
        capture: async (target) => {
          const forced = CaptureSession.forceFailure
          if (forced) return { ok: false, reason: forced, detail: 'injected for --self-test' }
          return real.capture(target)
        },
      },
      store: this.store,
      tracker,
      registry,
      now: () => new Date(),
      bundleRoot: root,
    })

    this.wireIpc()
  }

  async capture(intent: CaptureIntent): Promise<void> {
    if (this.overlay.isVisible() || this.regionOverlay.isVisible()) return

    if (intent === 'region') {
      await this.regionOverlay.show()
      return
    }

    const target = await this.targetFor(intent)
    if (!target) return

    await this.beginAndShow(target, intent)
  }

  /** Called once the picker has a rectangle: capture it, then raise the bar. */
  private async captureRegion(rect: Rect): Promise<void> {
    // Awaited: the picker must be off screen before the shutter, or it ends
    // up inside the screenshot.
    await this.regionOverlay.hide()
    await this.beginAndShow({ kind: 'region', ...rect }, 'region')
  }

  private async beginAndShow(
    target: CaptureTarget,
    intentLabel: string,
    isRetry = false,
  ): Promise<void> {
    const started = Date.now()
    this.lastTarget = target
    const begun = await this.flow.begin(target, this.overlay.hostApp() ?? undefined)

    if (!begun.ok) {
      // The bar comes up anyway. A failure the user cannot see is a capture
      // that silently did nothing, which is worse than an error.
      console.log(`[capture] failed: ${begun.reason}${begun.detail ? ` — ${begun.detail}` : ''}`)
      await this.overlay.show()
      await this.overlay.send('capture:failed', {
        reason: begun.reason,
        explanation: explainFailure(begun.reason, begun.detail),
      })
      return
    }

    this.pending = begun.pending
    const open = (await this.store.listBundles()).filter((b) => b.status === 'open' && !b.damaged)
    this.bundleIds = open.map((b) => b.id)

    await this.overlay.show()
    await this.overlay.send('capture:pending', {
      isRetry,
      kind: begun.pending.kind,
      app: this.overlay.hostApp(),
      width: begun.pending.width,
      height: begun.pending.height,
      destination: begun.pending.destination,
      bundles: open.map((b) => ({ id: b.id, intent: b.intent, captureCount: b.captureCount })),
    })

    console.log(`[capture] ${intentLabel} — bar up in ${Date.now() - started}ms`)
  }

  private async targetFor(intent: CaptureIntent): Promise<CaptureTarget | null> {
    if (intent === 'screen') return { kind: 'screen' }
    const located = await this.locator.frontmost()
    if (!located.ok) {
      console.log(`[capture] no window to capture: ${located.reason}`)
      return null
    }
    return { kind: 'window', windowId: located.window.windowId }
  }

  private wireIpc(): void {
    ipcMain.handle('capture:commit', async (_e, payload: { note: string; targetIndex: number; copyPointer: boolean }) => {
      if (!this.pending) return null

      const target =
        payload.targetIndex === -1
          ? ({ kind: 'new' } as const)
          : payload.targetIndex === 0
            ? ({ kind: 'active' } as const)
            : ({ kind: 'bundle', id: this.bundleIds[payload.targetIndex - 1]! } as const)

      const bundle = await this.flow.commit(this.pending, payload.note, {
        target,
        copyPointer: payload.copyPointer,
      })

      this.pending = null
      await this.overlay.hide()
      console.log(`[capture] filed into ${bundle.id} (${bundle.captures.length} captures)`)
      return { id: bundle.id }
    })

    ipcMain.handle('capture:retry', async () => {
      if (!this.lastTarget) return null
      // Same target, and the renderer keeps the note it already holds.
      await this.beginAndShow(this.lastTarget, 'retry', true)
      return null
    })

    ipcMain.handle('capture:whole-screen', async () => {
      await this.beginAndShow({ kind: 'screen' }, 'screen-instead', true)
      return null
    })

    ipcMain.handle('capture:open-settings', async (_e, pane: string) => {
      await shell.openExternal(
        `x-apple.systempreferences:com.apple.preference.security?Privacy_${pane}`,
      )
      return null
    })

    ipcMain.handle('region:pick', async (_e, rect: Rect) => {
      await this.captureRegion(rect)
      return null
    })

    ipcMain.handle('region:cancel', async () => {
      await this.regionOverlay.hide()
      console.log('[capture] region cancelled')
      return null
    })

    ipcMain.handle('capture:discard', async () => {
      if (this.pending) await this.flow.discard(this.pending)
      this.pending = null
      await this.overlay.hide()
      console.log('[capture] discarded')
      return null
    })
  }
}
