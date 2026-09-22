import { shell } from 'electron'
import type { BrowserWindow } from 'electron'
import { isAllowedExternal } from '@hiveannotate/core'

/**
 * Links open in the user's browser, never inside the app, and only to
 * hiveop.io. Anything else is refused: a page in this app never navigates
 * away or opens a window of its own.
 */
export function routeLinksToBrowser(win: BrowserWindow): void {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternal(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (url === win.webContents.getURL()) return
    event.preventDefault()
    if (isAllowedExternal(url)) void shell.openExternal(url)
  })
}
