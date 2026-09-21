import { BrowserWindow, screen } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { helperPath } from './helper.ts'

const run = promisify(execFile)
const here = fileURLToPath(new URL('.', import.meta.url))

interface HostApp {
  bundleId: string
  app: string
}

/**
 * The capture overlay.
 *
 * Established by the spike (hive-v1-02): a `type: 'panel'` window shown with
 * showInactive() and then focused becomes key and receives keystrokes **while
 * the host app stays frontmost**. That combination is normally impossible on
 * macOS, and every screen in the design depends on it.
 *
 * macOS does NOT hand focus back on dismiss. The host app must be recorded
 * before showing and reactivated explicitly afterwards.
 */
export class Overlay {
  private window: BrowserWindow | null = null
  private host: HostApp | null = null
  /** Resolves once the renderer can receive IPC. */
  private ready: Promise<void> = Promise.resolve()

  ensure(): BrowserWindow {
    if (this.window && !this.window.isDestroyed()) return this.window

    const { width, height } = screen.getPrimaryDisplay().workAreaSize

    this.window = new BrowserWindow({
      width: 780,
      height: 260,
      x: Math.round((width - 780) / 2),
      y: Math.round(height - 380),
      show: false,
      frame: false,
      transparent: true,
      hasShadow: true,
      resizable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      type: 'panel',
      webPreferences: {
        preload: join(here, '../preload/index.cjs'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    })

    // Surface renderer console output during development so a failure in the
    // bar is visible from the terminal rather than requiring devtools.
    this.window.webContents.on('console-message', (_e, _level, message) => {
      console.log(`[renderer] ${message}`)
    })

    this.window.setAlwaysOnTop(true, 'screen-saver')
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    // The window is created lazily on first capture, so a send() issued
    // immediately after would land before the renderer has registered its
    // listeners and be dropped — the bar would come up blank exactly once.
    this.ready = new Promise<void>((resolve) => {
      this.window?.webContents.once('did-finish-load', () => resolve())
    })

    const devServer = process.env['ELECTRON_RENDERER_URL']
    if (devServer) void this.window.loadURL(`${devServer}#capture`)
    else void this.window.loadFile(join(here, '../renderer/index.html'), { hash: 'capture' })

    return this.window
  }

  /** Records the host app, then shows the panel without deactivating it. */
  async show(): Promise<void> {
    this.host = await this.readHost()
    const win = this.ensure()
    win.showInactive()
    win.focus()
  }

  /** Hides the panel and hands focus back — nothing does this for us. */
  async hide(): Promise<void> {
    this.window?.hide()
    if (!this.host?.bundleId) return
    try {
      await run('open', ['-b', this.host.bundleId])
    } catch {
      // Losing the handback is a papercut, not a failure worth surfacing:
      // the capture is already filed.
    }
  }

  async send(channel: string, payload: unknown): Promise<void> {
    await this.ready
    this.window?.webContents.send(channel, payload)
  }

  isVisible(): boolean {
    return this.window?.isVisible() ?? false
  }

  hostApp(): string | null {
    return this.host?.app ?? null
  }

  private async readHost(): Promise<HostApp | null> {
    try {
      const { stdout } = await run(helperPath(), ['frontmost', '--exclude-pid', String(process.pid)])
      const parsed = JSON.parse(stdout) as { ok: boolean; app?: string; bundleId?: string }
      if (!parsed.ok) return null
      return { bundleId: parsed.bundleId ?? '', app: parsed.app ?? '' }
    } catch {
      return null
    }
  }
}
