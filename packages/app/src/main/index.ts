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
    const { BundleStore, defaultBundleRoot } = await import('@hiveannotate/core')
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const visible = () => BrowserWindow.getAllWindows().find((w) => w.isVisible())

    const type = (win: BrowserWindow, keys: string[]): void => {
      for (const key of keys) {
        win.webContents.sendInputEvent({ type: 'keyDown', keyCode: key })
        if (key.length === 1) win.webContents.sendInputEvent({ type: 'char', keyCode: key })
        win.webContents.sendInputEvent({ type: 'keyUp', keyCode: key })
      }
    }

    const results: string[] = []
    const check = (name: string, pass: boolean, detail = ''): void => {
      results.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
      console.log(results[results.length - 1])
    }

    await wait(1200)

    // --- full-screen capture through the bar -------------------------------
    await session?.capture('screen')
    await wait(1500)
    const bar = visible()
    check('screen: bar appeared', Boolean(bar))
    if (bar) {
      type(bar, [...'sidebar bug'])
      await wait(300)
      type(bar, ['Return'])
      await wait(1800)
    }

    // --- region capture through the picker, then the bar -------------------
    await session?.capture('region')
    await wait(1500)
    const picker = visible()
    check('region: picker appeared', Boolean(picker))
    if (picker) {
      type(picker, ['s', 'd'])
      await wait(300)
      type(picker, ['Return'])
      await wait(1800)

      const regionBar = visible()
      check('region: bar appeared after picking', Boolean(regionBar))
      if (regionBar) {
        type(regionBar, [...'console output'])
        await wait(300)
        type(regionBar, ['Return'])
        await wait(1800)
      }
    }

    // --- a failed capture must keep the note and retry into it -------------
    const { CaptureSession: Session } = await import('./captureSession.ts')
    Session.forceFailure = 'no-permission'
    await session?.capture('screen')
    await wait(1500)

    const failedBar = visible()
    check('failure: the bar appeared anyway', Boolean(failedBar))
    if (failedBar) {
      const shown = await failedBar.webContents.executeJavaScript('document.body.innerText')
      check('failure: it explains what happened', /Screen Recording is off/i.test(shown), '')
      check('failure: it says nothing was taken', /nothing was taken/i.test(shown), '')

      // Type into the failed bar — this is the sentence that must survive.
      type(failedBar, [...'note typed during failure'])
      await wait(300)

      // The grant "arrives"; retry with ⏎.
      Session.forceFailure = null
      type(failedBar, ['Return'])
      await wait(2000)

      const retried = visible()
      const noteAfter = retried
        ? await retried.webContents.executeJavaScript('document.querySelector("#note")?.value ?? ""')
        : ''
      check('failure: the note survived the retry', noteAfter === 'note typed during failure', JSON.stringify(noteAfter))

      if (retried) {
        type(retried, ['Return'])
        await wait(1800)
      }
    }

    const store = new BundleStore(defaultBundleRoot())
    const bundles = await store.listBundles()

    // Both captures happen seconds apart, so the Active Bundle is still fresh
    // and the second one appends. One bundle with two captures is the correct
    // outcome — and it exercises the append path as well as creation.
    check('one bundle, two captures', bundles.length === 1, `found ${bundles.length} bundle(s)`)
    if (bundles[0]) {
      const bundle = await store.getBundle(bundles[0].id)
      check('all three captures landed', bundle.captures.length === 3, `${bundle.captures.length} capture(s)`)

      const screen = bundle.captures[0]
      const region = bundle.captures[1]
      check(
        'the screen capture has real pixels',
        Boolean(screen && screen.kind === 'screen' && screen.width > 1000),
        screen ? `${screen.kind} ${screen.width}x${screen.height}` : 'none',
      )
      // s then d on the grid picks a small middle-right cell, so the region
      // must be markedly smaller than the full screen and tagged as a region.
      check(
        'the region capture is a genuine sub-rectangle',
        Boolean(region && region.kind === 'region' && screen && region.width < screen.width / 2),
        region ? `${region.kind} ${region.width}x${region.height}` : 'none',
      )
      check('its note was recorded', bundle.captures[1]?.note === 'console output', bundle.captures[1]?.note ?? '')
      check(
        'the retried capture filed under the note typed during the failure',
        bundle.captures.some((c) => c.note === 'note typed during failure'),
        bundle.captures.map((c) => c.note).join(' | '),
      )
    }

    const failed = results.filter((r) => r.startsWith('FAIL'))
    console.log(`\nSELF-TEST: ${results.length - failed.length}/${results.length} passed`)
    console.log(failed.length ? 'SELF-TEST FAIL' : 'SELF-TEST PASS')
    app.quit()
  })
}
