import { app, Tray, Menu, BrowserWindow, nativeImage } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core'
import type { CaptureIntent } from '@hiveannotate/core'
import { startHotkeys } from './hotkeys.ts'
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
      preload: join(here, '../preload/index.mjs'),
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

function onCaptureIntent(intent: CaptureIntent): void {
  // The overlay lands in hive-v1-11/12/13. Until then the chord proves it
  // reaches us, which is what hive-v1-08 is responsible for.
  console.log(`[capture] intent: ${intent}`)
}

void app.whenReady().then(() => {
  buildTray()

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

// A background app has no windows to keep it alive; closing the About window
// must not quit it.
app.on('window-all-closed', () => {})
