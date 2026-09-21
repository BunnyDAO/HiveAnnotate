import { app, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { fileURLToPath } from 'node:url'
import {
  AdapterRegistry,
  BundleStore,
  bundlePointer,
  defaultBundleRoot,
} from '@hiveannotate/core'

const here = fileURLToPath(new URL('.', import.meta.url))

/** Serves capture images to the renderer, scoped to the bundle root. */
const SCHEME = 'hive-capture'

export function registerCaptureProtocol(root: string): void {
  protocol.handle(SCHEME, (request) => {
    const requested = decodeURIComponent(new URL(request.url).pathname).replace(/^\//, '')
    const resolved = normalize(join(root, requested))

    // A path that escapes the bundle root is never served, whatever it claims.
    if (resolved !== root && !resolved.startsWith(root + sep)) {
      return new Response('forbidden', { status: 403 })
    }

    return net.fetch(pathToFileURL(resolved).toString())
  })
}

/**
 * The Catalogue: review, correction and handoff.
 *
 * Explicitly NOT where annotation happens — that is the capture bar. If
 * annotating starts migrating here, the product has regressed into the thing
 * it was built to replace.
 *
 * Every mutation goes through BundleStore. This module never touches the
 * filesystem and never knows what a handoff destination is; both are asserted
 * by tests/catalogue-boundaries.test.ts.
 */
export class Catalogue {
  private window: BrowserWindow | null = null
  private readonly store: BundleStore
  private readonly registry: AdapterRegistry
  private readonly root: string

  constructor(registry: AdapterRegistry) {
    this.root = defaultBundleRoot()
    this.store = new BundleStore(this.root)
    this.registry = registry
    this.wireIpc()
  }

  /** ⌥4 — open the Catalogue, or put it away if it is already in front. */
  toggle(): void {
    if (this.window && !this.window.isDestroyed() && this.window.isVisible() && this.window.isFocused()) {
      this.window.hide()
      return
    }
    this.open()
  }

  open(): void {
    // HiveAnnotate is a menu-bar app with no dock tile, so showing a window is
    // not enough to bring it in front of whatever the user is working in — the
    // app has to take focus explicitly, or the Catalogue opens behind.
    app.focus({ steal: true })

    if (this.window && !this.window.isDestroyed()) {
      this.window.show()
      this.window.focus()
      this.window.webContents.send('catalogue:refresh')
      return
    }

    this.window = new BrowserWindow({
      width: 1180,
      height: 760,
      minWidth: 900,
      minHeight: 560,
      title: 'HiveAnnotate',
      titleBarStyle: 'hiddenInset',
      backgroundColor: '#14120E',
      show: false,
      webPreferences: {
        preload: join(here, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.window.once('ready-to-show', () => this.window?.show())
    this.window.on('closed', () => { this.window = null })

    const devServer = process.env['ELECTRON_RENDERER_URL']
    if (devServer) void this.window.loadURL(`${devServer}#catalogue`)
    else void this.window.loadFile(join(here, '../renderer/index.html'), { hash: 'catalogue' })
  }

  private wireIpc(): void {
    ipcMain.handle('catalogue:list', async () => this.store.listBundles())

    ipcMain.handle('catalogue:get', async (_e, id: string) => {
      const bundle = await this.store.getBundle(id)
      return {
        ...bundle,
        captures: bundle.captures.map((c) => ({
          ...c,
          // The renderer never sees a filesystem path; it gets a scoped URL.
          src: `${SCHEME}://local/${encodeURIComponent(id)}/${encodeURIComponent(c.file)}`,
        })),
        pointer: bundlePointer(bundle.id),
      }
    })

    ipcMain.handle('catalogue:edit-note', async (_e, p: { id: string; index: number; note: string }) =>
      this.store.editNote(p.id, p.index, p.note),
    )

    ipcMain.handle('catalogue:edit-intent', async (_e, p: { id: string; intent: string }) =>
      this.store.editIntent(p.id, p.intent),
    )

    ipcMain.handle('catalogue:delete-capture', async (_e, p: { id: string; index: number }) =>
      this.store.deleteCapture(p.id, p.index),
    )

    ipcMain.handle('catalogue:move-capture', async (_e, p: { from: string; index: number; to: string | null }) =>
      p.to === null
        ? this.store.moveCaptureToNewBundle(p.from, p.index)
        : this.store.moveCapture(p.from, p.index, p.to),
    )

    ipcMain.handle('catalogue:close-bundle', async (_e, id: string) => this.store.closeBundle(id))

    ipcMain.handle('catalogue:handoff', async (_e, p: { id: string; adapterId: string }) => {
      const bundle = await this.store.getBundle(p.id)
      await this.registry.handoff(p.adapterId, {
        bundle,
        directory: join(this.root, bundle.id),
        pointer: bundlePointer(bundle.id),
      })
      return null
    })

    ipcMain.handle('catalogue:adapters', async () => this.registry.list())
  }
}
