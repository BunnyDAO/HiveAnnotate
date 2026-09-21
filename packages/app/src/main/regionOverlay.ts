import { BrowserWindow, screen } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The full-screen grid the region picker draws on.
 *
 * Covers the display the cursor is on, above everything including a fullscreen
 * app. It is a `type: 'panel'` window for the same reason the capture bar is:
 * it must take keystrokes without deactivating whatever is underneath.
 */
export class RegionOverlay {
  private window: BrowserWindow | null = null
  private ready: Promise<void> = Promise.resolve()

  async show(): Promise<Rect> {
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
    const bounds = display.bounds

    if (!this.window || this.window.isDestroyed()) this.create()

    const win = this.window!
    win.setBounds(bounds)
    win.showInactive()
    win.focus()

    await this.ready
    win.webContents.send('region:bounds', bounds)
    return bounds
  }

  /**
   * Hides the picker and resolves only once it is actually gone.
   *
   * hide() is a request to the window server, not a guarantee. If the capture
   * that follows wins the race, the dim overlay and the grid letters are baked
   * into the user's screenshot.
   */
  async hide(): Promise<void> {
    const win = this.window
    if (!win || !win.isVisible()) return

    await new Promise<void>((resolve) => {
      win.once('hide', () => resolve())
      win.hide()
    })
    // One more composited frame after the hide event, so the pixels on screen
    // no longer include the overlay when screencapture reads them.
    await new Promise((resolve) => setTimeout(resolve, 60))
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  private create(): void {
    this.window = new BrowserWindow({
      show: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      type: 'panel',
      webPreferences: {
        preload: join(here, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    this.window.webContents.on('console-message', (event) => {
      console.log(`[picker] ${(event as unknown as { message: string }).message}`)
    })

    this.window.setAlwaysOnTop(true, 'screen-saver')
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    this.ready = new Promise<void>((resolve) => {
      this.window?.webContents.once('did-finish-load', () => resolve())
    })

    const devServer = process.env['ELECTRON_RENDERER_URL']
    if (devServer) void this.window.loadURL(`${devServer}#region`)
    else void this.window.loadFile(join(here, '../renderer/index.html'), { hash: 'region' })
  }
}
