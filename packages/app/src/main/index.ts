import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core'
import type { CaptureIntent } from '@hiveannotate/core'
import { startHotkeys } from './hotkeys.ts'
import { CaptureSession } from './captureSession.ts'
import { buildAdapterRegistry } from './handoff.ts'
import type { HotkeyService } from './hotkeys.ts'

const here = fileURLToPath(new URL('.', import.meta.url))

// A menu-bar background app. There is no main window and no dock tile: global
// hotkeys need a resident process, and the Catalogue (hive-v1-14) will be a
// window this process opens on demand. LSUIElement in the packaged Info.plist
// does this for the built app; dock.hide() covers `electron-vite dev`.
app.dock?.hide()

let tray: Tray | null = null
let aboutWindow: BrowserWindow | null = null
let hotkeys: HotkeyService | null = null
let secureInputBlocking = false

function showAbout(): void {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show()
    aboutWindow.focus()
    return
  }

  aboutWindow = new BrowserWindow({
    width: 380,
    height: 260,
    resizable: false,
    title: APP_NAME,
    show: false,
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  aboutWindow.once('ready-to-show', () => aboutWindow?.show())
  aboutWindow.on('closed', () => { aboutWindow = null })

  const devServer = process.env['ELECTRON_RENDERER_URL']
  if (devServer) void aboutWindow.loadURL(devServer)
  else void aboutWindow.loadFile(join(here, '../renderer/index.html'))
}

function renderTrayMenu(): void {
  if (!tray) return

  const chordItems = (hotkeys?.registrations ?? []).map(({ chord, registered }) => ({
    label: registered
      ? `${chord.label}   ${chord.accelerator}`
      : `${chord.label}   — ${chord.accelerator} is taken by another app`,
    enabled: false,
  }))

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `${APP_NAME} — ${BUNDLE_ID}`, enabled: false },
      { type: 'separator' },
      ...(secureInputBlocking
        ? [
            {
              label: 'Hotkeys blocked — a password field has secure input on',
              enabled: false,
            },
            { type: 'separator' as const },
          ]
        : []),
      ...chordItems,
      { type: 'separator' },
      { label: 'About', click: showAbout },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]),
  )

  // The hotkey never arrives while Secure Input is on, so the bar cannot
  // appear to explain itself. The menu bar is the only surface left.
  tray.setToolTip(
    secureInputBlocking ? `${APP_NAME} — hotkeys blocked by secure input` : APP_NAME,
  )
}

function buildTray(): void {
  // Anchored to the main bundle so the same path resolves in `electron-vite
  // dev` and inside the packaged asar. app.getAppPath() differs between them.
  const icon = nativeImage.createFromPath(join(here, '../../build/trayTemplate.png'))
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  renderTrayMenu()
}

let session: CaptureSession | null = null

function onCaptureIntent(intent: CaptureIntent): void {
  void session?.capture(intent)
}

void app.whenReady().then(() => {
  buildTray()

  session = new CaptureSession(buildAdapterRegistry())

  hotkeys = startHotkeys(onCaptureIntent)
  for (const { chord, registered } of hotkeys.registrations) {
    console.log(`[chord] ${chord.accelerator} (${chord.intent}): ${registered ? 'registered' : 'TAKEN by another app'}`)
  }

  hotkeys.onSecureInputChange((blocked) => {
    secureInputBlocking = blocked
    console.log(`[secure-input] ${blocked ? 'BLOCKING hotkeys' : 'clear'}`)
    renderTrayMenu()
  })

  renderTrayMenu()
})

app.on('will-quit', () => hotkeys?.dispose())

/**
 * Dev-only end-to-end check: fire a capture, type into the bar, press Enter,
 * and report whether a bundle landed on disk. Point HIVEANNOTATE_HOME at a
 * temp directory before running it.
 */
if (process.argv.includes('--self-test')) {
  void app.whenReady().then(async () => {
    const { defaultBundleRoot } = await import('@hiveannotate/core')
    const { BundleStore } = await import('@hiveannotate/core')
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

    await wait(1200)
    await session?.capture('screen')
    await wait(1500)

    const overlayWindow = BrowserWindow.getAllWindows().find((w) => w.isVisible())
    if (!overlayWindow) {
      console.log('SELF-TEST FAIL: the capture bar never appeared')
      app.quit()
      return
    }
    console.log('SELF-TEST: bar is visible')

    for (const ch of ['s', 'i', 'd', 'e', 'b', 'a', 'r', ' ', 'b', 'u', 'g']) {
      overlayWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
      overlayWindow.webContents.sendInputEvent({ type: 'char', keyCode: ch })
      overlayWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
    }
    await wait(400)
    overlayWindow.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
    overlayWindow.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
    await wait(2000)

    const bundles = await new BundleStore(defaultBundleRoot()).listBundles()
    if (bundles.length === 1 && bundles[0]) {
      console.log(`SELF-TEST PASS: filed "${bundles[0].intent}" as ${bundles[0].id} with ${bundles[0].captureCount} capture(s)`)
    } else {
      console.log(`SELF-TEST FAIL: expected one bundle, found ${bundles.length}`)
    }
    app.quit()
  })
}

// A background app has no windows to keep it alive; closing the About window
// must not quit it.
app.on('window-all-closed', () => {})
