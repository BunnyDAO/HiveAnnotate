import { app, Tray, Menu, BrowserWindow, nativeImage, protocol } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core'
import type { ChordAction } from '@hiveannotate/core'
import { defaultBundleRoot, formatAccelerator } from '@hiveannotate/core'
import { startHotkeys } from './hotkeys.ts'
import { CaptureSession } from './captureSession.ts'
import { Catalogue, registerCaptureProtocol } from './catalogue.ts'
import { buildAdapterRegistry } from './handoff.ts'
import type { HotkeyService } from './hotkeys.ts'

const here = fileURLToPath(new URL('.', import.meta.url))

// A menu-bar background app. There is no main window and no dock tile: global
// hotkeys need a resident process, and the Catalogue (hive-v1-14) will be a
// window this process opens on demand. LSUIElement in the packaged Info.plist
// does this for the built app; dock.hide() covers `electron-vite dev`.
app.dock?.hide()

// Must be declared before the app is ready, or protocol.handle refuses it.
protocol.registerSchemesAsPrivileged([
  { scheme: 'hive-capture', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

let tray: Tray | null = null
let aboutWindow: BrowserWindow | null = null
let hotkeys: HotkeyService | null = null
let secureInputBlocking = false
/** The app macOS blames for Secure Input, when it is on. */
let secureInputHolder: string | null = null

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

let catalogue: Catalogue | null = null

/** The labels currently in the tray menu. Used by --self-test. */
let lastTrayLabels: string[] = []
function trayMenuLabels(): string[] {
  return lastTrayLabels
}

function renderTrayMenu(): void {
  if (!tray) return

  const chordItems = (hotkeys?.registrations ?? []).map(({ chord, registered }) => ({
    label: registered
      ? `${chord.label}   ${formatAccelerator(chord.accelerator)}`
      : `${chord.label}   — ${formatAccelerator(chord.accelerator)} is taken by another app`,
    enabled: false,
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: `${APP_NAME} — ${BUNDLE_ID}`, enabled: false },
    { type: 'separator' },
    ...(secureInputBlocking
      ? [
          {
            label: secureInputHolder
              ? `Hotkeys blocked by ${secureInputHolder} — close its password prompt`
              : 'Hotkeys blocked — a password field has secure input on',
            enabled: false,
          },
          { type: 'separator' as const },
        ]
      : []),
    ...chordItems,
    { type: 'separator' },
    { label: 'Open Catalogue', click: () => catalogue?.open() },
    { label: 'About', click: showAbout },
    { type: 'separator' },
    { label: 'Quit', role: 'quit' },
  ]
  lastTrayLabels = template.map((item) => item.label ?? '').filter(Boolean)
  tray.setContextMenu(Menu.buildFromTemplate(template))

  // The hotkey never arrives while Secure Input is on, so the bar cannot
  // appear to explain itself. The menu bar is the only surface left.
  tray.setToolTip(
    secureInputBlocking
      ? `${APP_NAME} — hotkeys blocked${secureInputHolder ? ` by ${secureInputHolder}` : ''}`
      : APP_NAME,
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

function onCaptureIntent(intent: ChordAction): void {
  if (intent === 'catalogue') {
    catalogue?.toggle()
    return
  }
  void session?.capture(intent)
}

void app.whenReady().then(() => {
  buildTray()

  registerCaptureProtocol(defaultBundleRoot())

  const registry = buildAdapterRegistry()
  session = new CaptureSession(registry)
  catalogue = new Catalogue(registry)

  hotkeys = startHotkeys(onCaptureIntent)
  for (const { chord, registered } of hotkeys.registrations) {
    console.log(`[chord] ${chord.accelerator} (${chord.intent}): ${registered ? 'registered' : 'TAKEN by another app'}`)
  }

  hotkeys.onSecureInputChange((state) => {
    secureInputBlocking = state.enabled
    secureInputHolder = state.holder ?? null
    console.log(
      `[secure-input] ${state.enabled ? `BLOCKING hotkeys${state.holder ? ` (held by ${state.holder})` : ''}` : 'clear'}`,
    )
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
      // Mark the middle cell, descend, then mark right-of-middle: the
      // accumulate model's route to the same small rectangle (hive-v1-17).
      type(picker, ['s', 'Space', 'd'])
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

    // --- the picker: letters toggle, and every hint is in plain words ------
    {
      const GLYPHS = /[⌃⌥⇧⌘⏎↩⎋⇥⌫␣]/
      await session?.capture('region')
      await wait(1500)
      const picker = visible()
      if (picker) {
        type(picker, ['q', 'e', 'e'])
        await wait(400)
        const text: string = await picker.webContents.executeJavaScript('document.body.innerText')
        // q, e, then e again: back to just q — the top-left ninth.
        check('picker: pressing a letter again unselects it', text.includes('0, 0 · 600 × 390'),
          (text.match(/-?\d+, -?\d+ · \d+ × \d+/) ?? ['no readout'])[0])
        check('picker: hints are words, not symbols', !GLYPHS.test(text),
          (text.match(GLYPHS) ?? ['none'])[0])
        type(picker, ['Escape'])
        await wait(800)
      } else {
        check('picker: pressing a letter again unselects it', false, 'picker did not appear')
      }

      await session?.capture('screen')
      await wait(1500)
      const wordsBar = visible()
      if (wordsBar) {
        const text: string = await wordsBar.webContents.executeJavaScript('document.body.innerText')
        check('capture bar: hints are words, not symbols', !GLYPHS.test(text) && /Shift \+ Enter/.test(text),
          (text.match(GLYPHS) ?? ['none'])[0])
        type(wordsBar, ['Escape'])
        await wait(800)
      }
    }

    // --- accumulate: q then e is the whole top row (hive-v1-17) -----------
    await session?.capture('region')
    await wait(1500)
    const widePicker = visible()
    if (widePicker) {
      type(widePicker, ['q', 'e'])
      await wait(300)
      type(widePicker, ['Return'])
      await wait(1800)
      const wideBar = visible()
      if (wideBar) {
        type(wideBar, [...'top bar'])
        await wait(300)
        type(wideBar, ['Return'])
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
      check('all four captures landed', bundle.captures.length === 4, `${bundle.captures.length} capture(s)`)


      const screen = bundle.captures[0]
      const region = bundle.captures[1]
      // q then e marks two corners of the top row, so the box is the full
      // width and a third of the height — a shape subdivision could not reach.
      const wide = bundle.captures.find((c) => c.note === 'top bar')
      check(
        'accumulate: q then e captured the full-width top row',
        Boolean(wide && screen && wide.width === screen.width && wide.height < screen.height / 2),
        wide ? `${wide.width}x${wide.height} of ${screen?.width}x${screen?.height}` : 'missing',
      )
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
      // The app the user was in is read before the shutter, so it is on the
      // capture. It used to be read when the bar opened — after filing.
      check(
        'captures record the app the user was in',
        bundle.captures.every((c) => typeof c.app === 'string' && c.app.length > 0),
        bundle.captures.map((c) => c.app ?? '(none)').join(' | '),
      )
      check(
        'the retried capture filed under the note typed during the failure',
        bundle.captures.some((c) => c.note === 'note typed during failure'),
        bundle.captures.map((c) => c.note).join(' | '),
      )
    }

    // --- the Catalogue -----------------------------------------------------
    catalogue?.open()
    await wait(2500)
    const cat = BrowserWindow.getAllWindows().find((w) => w.getTitle() === 'HiveAnnotate' && w.isVisible())
    check('catalogue: window opened', Boolean(cat))

    if (cat) {
      const text = await cat.webContents.executeJavaScript('document.body.innerText')
      check('catalogue: lists the bundle', /sidebar bug/i.test(text), '')
      check('catalogue: shows the capture count', /4 CAPTURES/i.test(text), '')

      // The images come through a scoped custom protocol; naturalWidth proves
      // they actually decoded rather than silently 404ing.
      const loaded = await cat.webContents.executeJavaScript(
        `(async () => { await new Promise(r => setTimeout(r, 800));
          const imgs = [...document.querySelectorAll('img')];
          return { count: imgs.length, decoded: imgs.filter(i => i.naturalWidth > 0).length } })()`,
      )
      check('catalogue: capture images loaded', loaded.count > 0 && loaded.decoded === loaded.count, `${loaded.decoded}/${loaded.count} decoded`)

      // A mutation driven through the real bridge, then verified on disk.
      await cat.webContents.executeJavaScript(
        `window.hive.catalogue.editNote(${JSON.stringify(bundles[0]?.id ?? '')}, 1, 'edited from the catalogue')`,
      )
      await wait(800)
      const reread = await store.getBundle(bundles[0]?.id ?? '')
      check(
        'catalogue: editing a note persisted through BundleStore',
        reread.captures[0]?.note === 'edited from the catalogue',
        reread.captures[0]?.note ?? '',
      )

      const md = await (await import('node:fs/promises')).readFile(
        `${defaultBundleRoot()}/${bundles[0]?.id}/bundle.md`,
        'utf8',
      )
      check('catalogue: bundle.md was regenerated', md.includes('edited from the catalogue'), '')

      // Double-click a thumbnail: the full-size viewer opens on that capture.
      const viewer = await cat.webContents.executeJavaScript(`(async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms))
        const thumb = document.querySelector('button[aria-label$="full size"]')
        if (!thumb) return { opened: false }
        thumb.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        // Wait for the image to actually decode, not a fixed delay: an <img>
        // with no explicit size is 0px wide until it loads, so measuring
        // early says nothing about whether the viewer works.
        let dialog = null, img = null
        for (let i = 0; i < 40; i++) {
          dialog = document.querySelector('[role="dialog"]')
          img = dialog?.querySelector('img')
          if (img && img.complete && img.naturalWidth > 0) break
          await wait(100)
        }
        await wait(100)
        // Measure NOW, while the viewer is open. Measured after Esc, the image
        // is detached from the page and always reads 0px — which is what the
        // first version of this check did.
        const fullWidth = img ? img.getBoundingClientRect().width : 0
        const decoded = img ? img.naturalWidth : 0
        const loadState = img ? (img.complete ? 'complete' : 'loading') : 'no img'
        const before = dialog?.innerText.match(/(\\d+) \\/ (\\d+)/)?.[0] ?? ''
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
        await wait(300)
        const after = document.querySelector('[role="dialog"]')?.innerText.match(/(\\d+) \\/ (\\d+)/)?.[0] ?? ''
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
        await wait(300)
        return {
          opened: Boolean(dialog),
          fullWidth, decoded, loadState,
          before, after,
          closed: !document.querySelector('[role="dialog"]'),
        }
      })()`)
      check('viewer: double-click opens a screenshot full size', viewer.opened && viewer.decoded > 0 && viewer.fullWidth > 176,
        `shown ${Math.round(viewer.fullWidth)}px wide vs a 176px thumbnail (natural ${viewer.decoded}px, ${viewer.loadState})`)
      check('viewer: arrow keys step through captures', viewer.before !== '' && viewer.after !== '' && viewer.before !== viewer.after,
        `${viewer.before} → ${viewer.after}`)
      check('viewer: Esc closes it', viewer.closed, '')
    }

    // The chord table: region on the easiest chord, and a chord for the Catalogue.
    {
      const regs = hotkeys?.registrations ?? []
      const find = (intent: string) => regs.find((r) => r.chord.intent === intent)
      check('chords: region picker is on Option+1', find('region')?.chord.accelerator === 'Alt+1' && Boolean(find('region')?.registered), '')
      check('chords: Option+4 opens the Catalogue', find('catalogue')?.chord.accelerator === 'Alt+4' && Boolean(find('catalogue')?.registered), '')
      const labels = trayMenuLabels()
      check(
        'tray: shortcuts read as "Option + 1", never Alt or a symbol',
        labels.some((l) => l.includes('Option + 1')) &&
          !labels.some((l) => /\bAlt\b|[⌃⌥⇧⌘↩⎋⇥⌫␣]/.test(l)),
        labels.filter((l) => /Option|Alt|⌥/.test(l)).join(' | '),
      )
    }

    const failed = results.filter((r) => r.startsWith('FAIL'))
    console.log(`\nSELF-TEST: ${results.length - failed.length}/${results.length} passed`)
    console.log(failed.length ? 'SELF-TEST FAIL' : 'SELF-TEST PASS')
    app.quit()
  })
}

/**
 * Dev-only: proves the region picker is never baked into a capture.
 *
 * Puts a solid-colour window on screen, then compares three shots of the same
 * rectangle: the bare backdrop, the real hide-then-capture path, and the picker
 * deliberately on screen. The real capture must match the bare backdrop.
 */
if (process.argv.includes('--leak-test')) {
  void app.whenReady().then(async () => {
    const { offColourFraction } = await import('./overlayDetector.ts')
    const { BundleStore, defaultBundleRoot } = await import('@hiveannotate/core')
    const { execFile: ef } = await import('node:child_process')
    const { promisify: pf } = await import('node:util')
    const shoot = pf(ef)
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const BLUE = { r: 16, g: 96, b: 240 }

    // The backdrop: a flat colour we control, so nothing else on the user's
    // display can make or break the result.
    const backdrop = new BrowserWindow({
      x: 120, y: 140, width: 900, height: 300,
      frame: false, hasShadow: false, resizable: false, show: false,
      backgroundColor: '#1060F0',
    })
    backdrop.setAlwaysOnTop(true, 'floating')
    void backdrop.loadURL('data:text/html,<body style="margin:0;background:%231060F0"></body>')
    backdrop.showInactive()
    await wait(1500)

    // Inset from the edges so window chrome and antialiasing stay out of it.
    const RECT = { x: 160, y: 180, width: 820, height: 220 }
    const R = `${RECT.x},${RECT.y},${RECT.width},${RECT.height}`
    const lines: string[] = []
    const report = (label: string, pass: boolean, detail: string) => {
      const line = `${pass ? 'PASS' : 'FAIL'}  ${label} — ${detail}`
      lines.push(line)
      console.log(line)
    }
    const pct = (n: number) => `${(n * 100).toFixed(2)}%`

    // 1. The bare backdrop.
    await shoot('screencapture', ['-x', '-R', R, '/tmp/hive-leak-bare.png'])
    const bare = await offColourFraction('/tmp/hive-leak-bare.png', BLUE)

    // 2. Positive control: picker on screen with q marked, so the spotlight's
    //    dim panels cover most of the rectangle.
    await session?.capture('region')
    await wait(1500)
    const picker = BrowserWindow.getAllWindows().find((w) => w.isVisible() && w !== backdrop)
    if (picker) {
      picker.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'q' })
      picker.webContents.sendInputEvent({ type: 'char', keyCode: 'q' })
      picker.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'q' })
    }
    await wait(600)
    await shoot('screencapture', ['-x', '-R', R, '/tmp/hive-leak-overlay.png'])
    const withOverlay = await offColourFraction('/tmp/hive-leak-overlay.png', BLUE)

    // See-through, measured. With q marked, the selection is the top-left
    // ninth (0,0 → 600,390). Inside it the spotlight must be a clear hole —
    // the backdrop visible, bar the q letter. Outside it must be dimmed.
    await shoot('screencapture', ['-x', '-R', '160,180,400,200', '/tmp/hive-leak-inside.png'])
    await shoot('screencapture', ['-x', '-R', '640,180,340,220', '/tmp/hive-leak-outside.png'])
    const inside = await offColourFraction('/tmp/hive-leak-inside.png', BLUE)
    const outside = await offColourFraction('/tmp/hive-leak-outside.png', BLUE)

    // 3. The real path: the picker is still up; pick exactly RECT, which runs
    //    the production hide-then-capture sequence.
    if (picker) {
      await picker.webContents.executeJavaScript(`window.hive.pickRegion(${JSON.stringify(RECT)})`)
    }
    await wait(1800)
    const bar = BrowserWindow.getAllWindows().find(
      (w) => w.isVisible() && w !== backdrop && w !== picker,
    )
    if (bar) {
      for (const ch of 'leak probe') {
        bar.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
        bar.webContents.sendInputEvent({ type: 'char', keyCode: ch })
        bar.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
      }
      await wait(300)
      bar.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
      bar.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
      await wait(1800)
    }

    let viaPicker = -1
    const store = new BundleStore(defaultBundleRoot())
    for (const summary of await store.listBundles()) {
      const bundle = await store.getBundle(summary.id)
      const shot = bundle.captures.find((c) => c.note === 'leak probe')
      if (shot) viaPicker = await offColourFraction(`${defaultBundleRoot()}/${bundle.id}/${shot.file}`, BLUE)
    }

    report('the bare backdrop is clean', bare < 0.01, `${pct(bare)} off-colour`)
    report('positive control: the overlay is detectable', withOverlay > 0.05, `${pct(withOverlay)} off-colour with the picker on screen`)
    report(
      'the picker is see-through inside the selection',
      inside < 0.15,
      `${pct(inside)} off-colour inside (only the grid letter should show)`,
    )
    report(
      'the picker dims outside the selection',
      outside > 0.5,
      `${pct(outside)} off-colour outside`,
    )
    report('the real capture was produced', viaPicker >= 0, viaPicker >= 0 ? 'found' : 'no capture filed')
    report(
      'the overlay is NOT baked into the real capture',
      viaPicker >= 0 && viaPicker < 0.01,
      `${pct(viaPicker)} off-colour (bare ${pct(bare)}, overlay ${pct(withOverlay)})`,
    )

    const failed = lines.filter((l) => l.startsWith('FAIL')).length
    console.log(`\nLEAK-TEST: ${lines.length - failed}/${lines.length} passed`)
    console.log(failed ? 'LEAK-TEST FAIL' : 'LEAK-TEST PASS')
    backdrop.destroy()
    app.quit()
  })
}

/**
 * Dev-only: opens a surface and photographs the screen, so layout can be
 * looked at rather than guessed at. `--snap picker` or `--snap bar`.
 */
const snapIndex = process.argv.indexOf('--snap')
if (snapIndex !== -1) {
  const surface = process.argv[snapIndex + 1] ?? 'picker'
  void app.whenReady().then(async () => {
    const { execFile: ef } = await import('node:child_process')
    const { promisify: pf } = await import('node:util')
    const shoot = pf(ef)
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
    await wait(1200)
    if (surface === 'fail') {
      const { CaptureSession: Session } = await import('./captureSession.ts')
      Session.forceFailure = 'no-permission'
    }
    await session?.capture(surface === 'picker' ? 'region' : 'screen')
    await wait(1500)
    await shoot('screencapture', ['-x', `/tmp/hive-snap-${surface}.png`])
    console.log(`SNAP: /tmp/hive-snap-${surface}.png`)
    const open = BrowserWindow.getAllWindows().find((w) => w.isVisible())
    open?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    await wait(500)
    app.quit()
  })
}
