import { app, Tray, Menu, BrowserWindow, nativeImage, protocol, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core'
import type { ChordAction } from '@hiveannotate/core'
import { defaultBundleRoot, formatAccelerator } from '@hiveannotate/core'
import { startHotkeys } from './hotkeys.ts'
import { CaptureSession } from './captureSession.ts'
import { Catalogue, registerCaptureProtocol } from './catalogue.ts'
import { routeLinksToBrowser } from './externalLinks.ts'
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
    width: 420,
    height: 380,
    resizable: false,
    title: APP_NAME,
    show: false,
    webPreferences: {
      preload: join(here, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  routeLinksToBrowser(aboutWindow)
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

  // Each shortcut is also a clickable item, so the menu is a cheat sheet you
  // can act on: click "Open the Catalogue" and it opens. (They were greyed-out
  // labels, with a separate "Open Catalogue" item further down.)
  const chordItems = (hotkeys?.registrations ?? []).map(({ chord, registered }) => ({
    label: registered
      ? `${chord.label}   ${formatAccelerator(chord.accelerator, process.platform)}`
      : `${chord.label}   — ${formatAccelerator(chord.accelerator, process.platform)} is taken by another app`,
    click: () => onCaptureIntent(chord.intent),
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
    { label: 'About HiveAnnotate', click: showAbout },
    // Free, and made by HiveOp: one quiet way in, not an advert.
    { label: 'Made by HiveOp — hiveop.io', click: () => void shell.openExternal('https://hiveop.io') },
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
    /**
     * The visible window for one surface, polled until it appears. Steps used
     * to take "whatever window is visible" after a fixed sleep; when a lookup
     * came up empty at the wrong instant the step silently skipped, a capture
     * bar stayed open, and the next step typed into it. Found four times.
     */
    const waitFor = async (surface: 'capture' | 'region' | 'catalogue', timeoutMs = 4000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        const w = BrowserWindow.getAllWindows().find(
          (x) => x.isVisible() && x.webContents.getURL().includes(`#${surface}`),
        )
        if (w) return w
        await wait(100)
      }
      return undefined
    }

    const openOverlay = () =>
      BrowserWindow.getAllWindows().find((x) => x.isVisible() && /#(capture|region)$/.test(x.webContents.getURL()))

    /** Before each capture: nothing may still be open from the step before. */
    const settle = async (before: string) => {
      for (let i = 0; i < 40 && openOverlay(); i++) await wait(100)
      const leftover = openOverlay()
      if (leftover) {
        console.log(`WARN  a window was still open before "${before}" — closing it`)
        leftover.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
        leftover.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Escape' })
        await wait(800)
      }
    }

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
    await settle('screen capture #1')
    await session?.capture('screen')
    await wait(1500)
    const bar = await waitFor('capture')
    check('screen: bar appeared', Boolean(bar))
    if (bar) {
      // Nothing is active yet, so this capture starts a new bundle — which
      // needs a name the user types. Enter on the note moves to the name field.
      type(bar, [...'sidebar bug'])
      await wait(300)
      type(bar, ['Return'])
      await wait(500)
      const focusedField: string = await bar.webContents.executeJavaScript('document.activeElement?.id ?? ""')
      const savedYet = (await new BundleStore(defaultBundleRoot()).listBundles()).length
      check('new bundle: Enter on the note asks for a name instead of saving',
        focusedField === 'bundle-name' && savedYet === 0, `focus=${focusedField}, bundles=${savedYet}`)
      type(bar, [...'sidebar bug'])
      await wait(300)
      type(bar, ['Return'])
      await wait(1800)
    }

    // --- region capture through the picker, then the bar -------------------
    await settle('region capture #2')
    await session?.capture('region')
    await wait(1500)
    const picker = await waitFor('region')
    check('region: picker appeared', Boolean(picker))
    if (picker) {
      // Mark the middle cell, descend, then mark right-of-middle: the
      // accumulate model's route to the same small rectangle (hive-v1-17).
      type(picker, ['s', 'Space', 'd'])
      await wait(300)
      type(picker, ['Return'])
      await wait(1800)

      const regionBar = await waitFor('capture')
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
      await settle('region capture #3')
      await session?.capture('region')
      await wait(1500)
      const picker = await waitFor('region')
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

      await settle('screen capture #4')
      await session?.capture('screen')
      await wait(1500)
      const wordsBar = await waitFor('capture')
      if (wordsBar) {
        const text: string = await wordsBar.webContents.executeJavaScript('document.body.innerText')
        check('capture bar: hints are words, not symbols', !GLYPHS.test(text) && /Shift \+ Enter/.test(text),
          (text.match(GLYPHS) ?? ['none'])[0])
        type(wordsBar, ['Escape'])
        await wait(800)
      }
    }

    // --- accumulate: q then e is the whole top row (hive-v1-17) -----------
    await settle('region capture #5')
    await session?.capture('region')
    await wait(1500)
    const widePicker = await waitFor('region')
    if (widePicker) {
      type(widePicker, ['q', 'e'])
      await wait(300)
      type(widePicker, ['Return'])
      await wait(1800)
      const wideBar = await waitFor('capture')
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
    await settle('screen capture #6')
    await session?.capture('screen')
    await wait(1500)

    const failedBar = await waitFor('capture')
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

      const retried = await waitFor('capture')
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
      check('chords: region picker is on Cmd/Ctrl + Shift + 1', find('region')?.chord.accelerator === 'CommandOrControl+Shift+1' && Boolean(find('region')?.registered), '')
      check('chords: Cmd/Ctrl + Shift + 0 opens the Catalogue', find('catalogue')?.chord.accelerator === 'CommandOrControl+Shift+0' && Boolean(find('catalogue')?.registered), '')
      const labels = trayMenuLabels()
      check(
        'tray: shortcuts read in this platform\'s words, never Alt or a symbol',
        labels.some((l) => l.includes(process.platform === 'darwin' ? 'Cmd + Shift + 1' : 'Ctrl + Shift + 1')) &&
          !labels.some((l) => /\bAlt\b|Option|[⌃⌥⇧⌘↩⎋⇥⌫␣]/.test(l)),
        labels.filter((l) => /Cmd|Ctrl|Option|Alt|⌥/.test(l)).join(' | '),
      )
    }

    // --- filing chips: start a new bundle right from the bar ---------------
    {
      const chipStore = new BundleStore(defaultBundleRoot())
      const bar = () =>
        BrowserWindow.getAllWindows().find((w) => w.isVisible() && w.webContents.getURL().includes('#capture'))
      const shiftTab = (w: BrowserWindow) => {
        w.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab', modifiers: ['shift'] })
        w.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab', modifiers: ['shift'] })
      }
      const newest = async (before: { id: string }[]) =>
        (await chipStore.listBundles()).find((b) => !before.some((x) => x.id === b.id))

      // 1. Accept the name taken from the note.
      let before = await chipStore.listBundles()
      await settle('screen capture #7')
      await session?.capture('screen')
      await wait(1500)
      let w = bar()
      if (w) {
        const text: string = await w.webContents.executeJavaScript('document.body.innerText')
        const chips: string[] = await w.webContents.executeJavaScript(
          `[...document.querySelectorAll('button[aria-pressed]')].map(b => b.innerText.trim())`,
        )
        check('chips: New bundle is offered, last in the row', /New bundle/.test(text) && /New bundle/.test(chips.at(-1) ?? ''),
          chips.join(' | '))
        type(w, [...'the note, not the name'])
        await wait(300)
        shiftTab(w) // from the default, one Shift+Tab wraps to "+ New bundle"
        await wait(400)
        const nameShown: string = await w.webContents.executeJavaScript('document.querySelector("#bundle-name")?.value ?? "(no field)"')
        // The user asked for this explicitly: the name must not echo the note.
        check('chips: New bundle shows an empty name field, not a copy of the note', nameShown === '', JSON.stringify(nameShown))
        type(w, [...'a separate problem'])
        await wait(300)
        type(w, ['Return'])
        await wait(1800)
      }
      let created = await newest(before)
      check('chips: the typed name names the bundle', created?.intent === 'a separate problem', created?.id ?? 'none created')

      // 2. Type a different name.
      before = await chipStore.listBundles()
      await settle('screen capture #8')
      await session?.capture('screen')
      await wait(1500)
      w = bar()
      if (w) {
        type(w, [...'login button misaligned'])
        await wait(300)
        shiftTab(w)
        await wait(400)
        type(w, [...'To do Bundle 4'])
        await wait(300)
        type(w, ['Return'])
        await wait(1800)
      }
      created = await newest(before)
      const createdFull = created ? await chipStore.getBundle(created.id) : null
      check(
        'chips: a typed name names the bundle; the note stays on the capture',
        createdFull?.intent === 'To do Bundle 4' && createdFull?.captures[0]?.note === 'login button misaligned',
        createdFull ? `${createdFull.intent} / ${createdFull.captures[0]?.note}` : 'none created',
      )

      // 3. The name is required.
      before = await chipStore.listBundles()
      await settle('screen capture #9')
      await session?.capture('screen')
      await wait(1500)
      w = bar()
      let refusal = ''
      if (w) {
        // A note is typed but no name: the note must not stand in for it.
        type(w, [...'a note but no name'])
        await wait(300)
        shiftTab(w)
        await wait(400)
        type(w, ['Return'])
        await wait(800)
        refusal = await w.webContents.executeJavaScript('document.body.innerText')
        type(w, ['Escape'])
        await wait(800)
      }
      const after = await chipStore.listBundles()
      check(
        'chips: a new bundle cannot be saved without a name',
        after.length === before.length && /Name the new bundle/.test(refusal),
        `bundles ${before.length} -> ${after.length}`,
      )
    }

    // --- preview the capture before committing it ----------------------------
    {
      const barWin = () =>
        BrowserWindow.getAllWindows().find((w) => w.isVisible() && w.webContents.getURL().includes('#capture'))
      const cmd = (w: BrowserWindow, key: string) => {
        w.webContents.sendInputEvent({ type: 'keyDown', keyCode: key, modifiers: ['meta'] })
        w.webContents.sendInputEvent({ type: 'keyUp', keyCode: key, modifiers: ['meta'] })
      }
      const beforeCount = (await new BundleStore(defaultBundleRoot()).listBundles()).reduce((n, b) => n + b.captureCount, 0)
      await settle('screen capture #10')
      await session?.capture('screen')
      await wait(1500)
      const w = barWin()
      if (w) {
        const small = w.getBounds()
        cmd(w, 'p')
        await wait(900)
        const big = w.getBounds()
        const shown = await w.webContents.executeJavaScript(`(async () => {
          const img = document.querySelector('img[alt="The capture you are about to save"]')
          for (let i = 0; i < 30 && img && !(img.complete && img.naturalWidth); i++) await new Promise(r => setTimeout(r, 100))
          return img ? { natural: img.naturalWidth, shown: Math.round(img.getBoundingClientRect().width) } : null
        })()`)
        check('preview: Cmd + P shows the capture large', Boolean(shown && shown.natural > 0 && big.width > small.width * 1.5),
          shown ? `window ${small.width}→${big.width}px, image ${shown.shown}px of ${shown.natural}` : 'no preview image')

        type(w, ['Escape'])
        await wait(700)
        const stillUp = barWin()
        check('preview: Esc closes the preview and keeps the capture', Boolean(stillUp) && (stillUp?.getBounds().width ?? 0) < big.width,
          stillUp ? `back to ${stillUp.getBounds().width}px` : 'the bar disappeared — capture thrown away')
        if (stillUp) {
          type(stillUp, ['Escape'])
          await wait(800)
        }
      }
      const afterCount = (await new BundleStore(defaultBundleRoot()).listBundles()).reduce((n, b) => n + b.captureCount, 0)
      check('preview: looking at a capture never saves it', afterCount === beforeCount, `${beforeCount} → ${afterCount}`)
    }

    // --- a bundle marked handled can be reopened ----------------------------
    {
      const rs = new BundleStore(defaultBundleRoot())
      const [some] = await rs.listBundles()
      const cat = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().includes('#catalogue'))
      if (some && cat) {
        await cat.webContents.executeJavaScript(`window.hive.catalogue.closeBundle(${JSON.stringify(some.id)})`)
        const closed = (await rs.getBundle(some.id)).status
        await cat.webContents.executeJavaScript(`window.hive.catalogue.reopenBundle(${JSON.stringify(some.id)})`)
        const reopened = (await rs.getBundle(some.id)).status
        check('catalogue: a handled bundle can be reopened', closed === 'closed' && reopened === 'open', `${closed} -> ${reopened}`)
      } else {
        check('catalogue: a handled bundle can be reopened', false, 'no bundle or no catalogue window')
      }
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
      const typeInto = (text: string) => {
        for (const ch of text) {
          bar.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
          bar.webContents.sendInputEvent({ type: 'char', keyCode: ch })
          bar.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
        }
      }
      const enter = () => {
        bar.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Return' })
        bar.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Return' })
      }
      // A fresh home has no active bundle: the note, then the required name.
      typeInto('leak probe')
      await wait(300)
      enter()
      await wait(500)
      typeInto('leak probe')
      await wait(300)
      enter()
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
    if (surface === 'about') {
      showAbout()
      await wait(2000)
      await shoot('screencapture', ['-x', '/tmp/hive-snap-about.png'])
      console.log('SNAP: /tmp/hive-snap-about.png')
      app.quit()
      return
    }
    if (surface === 'catalogue') {
      catalogue?.open()
      await wait(2500)
      await shoot('screencapture', ['-x', '/tmp/hive-snap-catalogue.png'])
      console.log('SNAP: /tmp/hive-snap-catalogue.png')
      app.quit()
      return
    }
    if (surface === 'fail') {
      const { CaptureSession: Session } = await import('./captureSession.ts')
      Session.forceFailure = 'no-permission'
    }
    await session?.capture(surface === 'picker' ? 'region' : 'screen')
    await wait(1500)
    if (surface === 'preview') {
      const w = BrowserWindow.getAllWindows().find((x) => x.isVisible() && x.webContents.getURL().includes('#capture'))
      w?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'p', modifiers: ['meta'] })
      w?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'p', modifiers: ['meta'] })
      await wait(900)
    }
    if (surface === 'preview') {
      const w = BrowserWindow.getAllWindows().find((x) => x.isVisible() && x.webContents.getURL().includes('#capture'))
      w?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'p', modifiers: ['meta'] })
      w?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'p', modifiers: ['meta'] })
      await wait(900)
    }
    if (surface === 'newbundle') {
      const w = BrowserWindow.getAllWindows().find((x) => x.isVisible() && x.webContents.getURL().includes('#capture'))
      for (const ch of 'checkout total is wrong') {
        w?.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
        w?.webContents.sendInputEvent({ type: 'char', keyCode: ch })
        w?.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
      }
      w?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Tab', modifiers: ['shift'] })
      w?.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Tab', modifiers: ['shift'] })
      await wait(600)
    }
    await shoot('screencapture', ['-x', `/tmp/hive-snap-${surface}.png`])
    console.log(`SNAP: /tmp/hive-snap-${surface}.png`)
    const open = BrowserWindow.getAllWindows().find((w) => w.isVisible())
    open?.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' })
    await wait(500)
    app.quit()
  })
}
