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
import { app, BrowserWindow, globalShortcut, ipcMain, screen } from 'electron'
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
  panel.webContents.send('shown', { previous })

  // showInactive() puts it on screen without activating; focus() is the part
  // that should make it key anyway.
  panel.showInactive()
  panel.focus()

  // Report what actually happened, a beat later, once macOS has settled.
  setTimeout(async () => {
    const nowFront = await frontmostApp()
    panel.webContents.send('report', {
      panelIsFocused: panel.isFocused(),
      frontmostAfterShow: nowFront?.name ?? null,
      stoleFocus: nowFront?.bundleId !== previous?.bundleId,
    })
  }, 250)
}

ipcMain.handle('dismiss', async () => {
  panel.hide()
  const restored = await reactivate(previous)
  return { restored, target: previous?.name ?? null }
})

app.whenReady().then(() => {
  panel = createPanel()

  const ok = globalShortcut.register('Alt+Shift+1', () => {
    if (panel.isVisible()) return
    showPanel()
  })

  console.log(ok ? 'READY — press ⌥⇧1 over another app' : 'FAILED to register ⌥⇧1')
  console.log('Quit with ⌃C in this terminal.')
})

app.on('window-all-closed', () => {})
app.on('will-quit', () => globalShortcut.unregisterAll())
