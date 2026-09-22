/**
 * Renders the brand mark to every PNG the app needs, from one definition.
 *
 *   npx electron packages/app/brand/render.mjs
 *
 * Uses an offscreen Electron window: exact SVG rendering with no extra
 * dependency, and nothing appears on screen.
 */
import { app, BrowserWindow } from 'electron'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { appIconSvg, markSvg, templateSmallSvg, templateSvg } from './mark.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const build = resolve(here, '../build')

// Every job is drawn at RENDER px and scaled down: tiny offscreen windows
// fail to load, and supersampling gives cleaner edges at 16px anyway.
const RENDER = 512
const jobs = [
  { out: 'icon.png', size: 1024, draw: (px) => appIconSvg(px) },
  { out: 'trayTemplate.png', size: 16, draw: (px) => templateSmallSvg(px) },
  { out: 'trayTemplate@2x.png', size: 32, draw: (px) => templateSvg(px) },
  { out: 'mark-256.png', size: 256, draw: (px) => markSvg({ size: px }) },
  // Bundled by the renderer for the About window and the Catalogue.
  { out: '../src/renderer/assets/mark.png', size: 256, draw: (px) => markSvg({ size: px }) },
]

app.dock?.hide()
// Each job closes its window; with none left Electron quits by default, which
// killed every job after the first. Quit only when the work is done.
app.on('window-all-closed', () => {})
app.whenReady().then(async () => {
  mkdirSync(build, { recursive: true })
  mkdirSync(resolve(here, '../src/renderer/assets'), { recursive: true })
  for (const job of jobs) {
    const px = Math.max(job.size, RENDER)
    const win = new BrowserWindow({
      width: px,
      height: px,
      show: false,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      webPreferences: { offscreen: true },
    })
    const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${job.draw(px)}</body></html>`
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    await new Promise((r) => setTimeout(r, 250))
    const image = await win.webContents.capturePage()
    writeFileSync(resolve(build, job.out), image.resize({ width: job.size, height: job.size, quality: 'best' }).toPNG())
    console.log(`wrote build/${job.out} (${job.size}px)`)
    win.destroy()
  }
  app.quit()
})
