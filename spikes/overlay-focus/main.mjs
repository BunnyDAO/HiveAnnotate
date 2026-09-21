/**
 * hive-v1-02 — throwaway harness. Not product code; deleted once the question
 * is answered.
 *
 * The question: can a panel receive keystrokes WITHOUT the app underneath
 * losing focus, caret, selection or scroll — and can focus be handed back
 * afterwards? On macOS these are normally mutually exclusive.
 *
 * Run:  npx electron spikes/overlay-focus/main.mjs
 */
import { app, BrowserWindow, globalShortcut, ipcMain, screen, Tray, Menu, nativeImage } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const run = promisify(execFile)
const here = dirname(fileURLToPath(import.meta.url))

app.dock?.hide()

let panel = null
/** The app that was frontmost when the hotkey fired, so we can hand focus back. */
let previous = null

/**
 * lsappinfo is a built-in CLI and needs no Accessibility permission, unlike
 * System Events scripting — which would itself prompt and muddy the result.
 */
async function frontmostApp() {
  try {
    const { stdout: asn } = await run('lsappinfo', ['front'])
    const id = asn.trim()
    if (!id) return null
    const [{ stdout: bundle }, { stdout: name }] = await Promise.all([
      run('lsappinfo', ['info', '-only', 'bundleid', id]),
      run('lsappinfo', ['info', '-only', 'name', id]),
    ])
    return {
      bundleId: (bundle.match(/"CFBundleIdentifier"="([^"]+)"/) ?? [])[1] ?? null,
      name: (name.match(/"LSDisplayName"="([^"]+)"/) ?? [])[1] ?? '(unknown)',
    }
  } catch (error) {
    return { bundleId: null, name: `(lsappinfo failed: ${error.message})` }
  }
}

async function reactivate(target) {
  if (!target?.bundleId) return false
  try {
    await run('open', ['-b', target.bundleId])
    return true
  } catch {
    return false
  }
}

function createPanel() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  const win = new BrowserWindow({
    width: 720,
    height: 320,
    x: Math.round((width - 720) / 2),
    y: Math.round(height - 420),
    show: false,
    frame: false,
    transparent: true,
    hasShadow: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    // The mechanism under test. Electron 28+ suppresses
    // activateIgnoringOtherApps for panels, which is what should let this
    // become key without activating the app.
    type: 'panel',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true },
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  win.loadFile(join(here, 'index.html'))
  return win
}

async function showPanel() {
  previous = await frontmostApp()
  console.log(`[hotkey] fired — frontmost was: ${previous?.name}`)
  panel.webContents.send('shown', { previous })

  // showInactive() puts it on screen without activating; focus() is the part
  // that should make it key anyway.
  panel.showInactive()
  panel.focus()

  // Report what actually happened, a beat later, once macOS has settled.
  setTimeout(async () => {
    const nowFront = await frontmostApp()
    const report = {
      panelIsFocused: panel.isFocused(),
      panelIsVisible: panel.isVisible(),
      frontmostAfterShow: nowFront?.name ?? null,
      stoleFocus: nowFront?.bundleId !== previous?.bundleId,
    }
    console.log(`[report] ${JSON.stringify(report)}`)
    panel.webContents.send('report', report)
  }, 250)
}

ipcMain.handle('dismiss', async () => {
  panel.hide()
  const restored = await reactivate(previous)
  console.log(`[dismiss] handed focus back to ${previous?.name}: ${restored}`)
  return { restored, target: previous?.name ?? null }
})

let keysSeen = 0
ipcMain.handle('typed', async (_e, count) => {
  keysSeen = count
  console.log(`[keys] panel received key #${count} — it IS key`)
})

/**
 * Unattended verification. Activates a host app, shows the panel, injects
 * keystrokes into it, dismisses, and checks focus came back — reporting each
 * step so the spike does not depend on a human watching a screen.
 */
async function runAuto() {
  const results = []
  const check = (name, pass, detail) => {
    results.push({ name, pass, detail })
    console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))

  for (const host of ['com.apple.TextEdit', 'com.apple.Safari']) {
    await run('open', ['-b', host]).catch(() => {})
    await wait(1800)

    const before = await frontmostApp()
    if (before?.bundleId !== host) {
      check(`[${host}] host became frontmost`, false, `frontmost is ${before?.name}`)
      continue
    }
    check(`[${host}] host became frontmost`, true, before.name)

    await showPanel()
    await wait(700)

    const after = await frontmostApp()
    check(`[${host}] panel is key`, panel.isFocused(), `isFocused=${panel.isFocused()}`)
    check(`[${host}] panel is visible`, panel.isVisible())
    check(
      `[${host}] host stayed frontmost`,
      after?.bundleId === host,
      `frontmost=${after?.name}`,
    )

    // Inject real key events at the webContents level and confirm the renderer
    // received them.
    keysSeen = 0
    for (const ch of ['h', 'i', 'v', 'e']) {
      panel.webContents.sendInputEvent({ type: 'keyDown', keyCode: ch })
      panel.webContents.sendInputEvent({ type: 'char', keyCode: ch })
      panel.webContents.sendInputEvent({ type: 'keyUp', keyCode: ch })
    }
    await wait(400)
    check(`[${host}] panel received keystrokes`, keysSeen >= 4, `${keysSeen} keys`)

    panel.hide()
    const restored = await reactivate(previous)
    await wait(1400)
    const back = await frontmostApp()
    check(
      `[${host}] focus handed back on dismiss`,
      restored && back?.bundleId === host,
      `frontmost=${back?.name}`,
    )
    await wait(400)
  }

  const failed = results.filter((r) => !r.pass)
  console.log(`\nRESULT: ${results.length - failed.length}/${results.length} checks passed`)
  console.log(failed.length ? `VERDICT: NEEDS REVIEW` : `VERDICT: CLEAN`)
  app.quit()
}

app.whenReady().then(() => {
  panel = createPanel()

  // Two chords: if one is swallowed by the OS or another app, the other still
  // proves the mechanism. Which one registered is itself a finding.
  for (const accel of ['Alt+Shift+1', 'Control+Alt+Space']) {
    const ok = globalShortcut.register(accel, () => {
      if (!panel.isVisible()) showPanel()
    })
    console.log(`[chord] ${accel}: ${ok ? 'registered' : 'FAILED'}`)
  }

  // A visible menu-bar presence, so "I see nothing" can be told apart from
  // "the app never started".
  const icon = nativeImage.createFromPath(
    join(here, '../../packages/app/build/trayTemplate.png'),
  )
  icon.setTemplateImage(true)
  const tray = new Tray(icon)
  tray.setToolTip('overlay focus spike')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Spike harness — hive-v1-02', enabled: false },
      { type: 'separator' },
      { label: 'Show panel now', click: () => { if (!panel.isVisible()) showPanel() } },
      { label: 'Quit', click: () => app.quit() },
    ]),
  )
  global.__tray = tray

  if (process.argv.includes('--auto')) {
    panel.webContents.once('did-finish-load', () => {
      setTimeout(runAuto, 600)
    })
    return
  }

  console.log('READY — look for the bracket icon in your menu bar.')
  console.log('Press the chord over another app, or use the tray menu.')
})

app.on('window-all-closed', () => {})
app.on('will-quit', () => globalShortcut.unregisterAll())
