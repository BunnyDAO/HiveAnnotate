import { BrowserWindow } from 'electron'
import type { Rect } from '@hiveannotate/core'

/** Held at full strength, then faded: long enough to read, short enough to ignore. */
const HOLD_MS = 180
const FADE_MS = 380

/**
 * The brief blue outline around what a capture just took.
 *
 * Drawn only after the shutter, so it can never end up in the picture. It
 * cannot take focus or clicks: it is a see-through panel shown inactive, and
 * mouse events pass straight through to whatever is underneath.
 */
export class CaptureFlash {
  private window: BrowserWindow | null = null
  private ready: Promise<void> = Promise.resolve()
  private timer: NodeJS.Timeout | null = null

  /** The last outline drawn, for --self-test. */
  lastBounds: Rect | null = null

  async show(rect: Rect, rounded: boolean): Promise<void> {
    if (!this.window || this.window.isDestroyed()) this.create()
    const win = this.window!
    await this.ready

    if (this.timer) clearTimeout(this.timer)
    win.setBounds(rect)
    this.lastBounds = rect
    await win.webContents.executeJavaScript(`flash(${rounded})`)
    win.showInactive()
    this.timer = setTimeout(() => this.hideNow(), HOLD_MS + FADE_MS + 40)
  }

  /** Off screen at once — before a later capture, so it is never photographed. */
  hideNow(): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = null
    if (this.window && !this.window.isDestroyed() && this.window.isVisible()) this.window.hide()
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
      movable: false,
      focusable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      enableLargerThanScreen: true,
      type: 'panel',
      webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
    })
    this.window.setIgnoreMouseEvents(true)
    this.window.setAlwaysOnTop(true, 'screen-saver')
    this.window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

    this.ready = new Promise<void>((resolve) => {
      this.window?.webContents.once('did-finish-load', () => resolve())
    })
    void this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(PAGE)}`)
  }
}

// Self-contained so the flash needs no renderer bundle, preload or IPC.
// #38bdf8 is the HiveOp accent.
const PAGE = `<!doctype html><html><head><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden}
#box{position:absolute;inset:0;box-sizing:border-box;border:3px solid #38bdf8;
  background:rgba(56,189,248,.10);box-shadow:inset 0 0 0 1px rgba(12,18,32,.55),inset 0 0 18px rgba(56,189,248,.35);opacity:0}
#box.on{animation:flash ${HOLD_MS + FADE_MS}ms ease-out forwards}
@keyframes flash{0%{opacity:1}${Math.round((HOLD_MS / (HOLD_MS + FADE_MS)) * 100)}%{opacity:1}100%{opacity:0}}
</style></head><body><div id="box"></div><script>
function flash(rounded){const b=document.getElementById('box');
b.style.borderRadius=rounded?'10px':'0';b.classList.remove('on');void b.offsetWidth;b.classList.add('on')}
</script></body></html>`
