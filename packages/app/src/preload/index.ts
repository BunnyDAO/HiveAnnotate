import { contextBridge, ipcRenderer } from 'electron'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core/appInfo'

export interface PendingView {
  kind: string
  app: string | null
  width: number
  height: number
  destination: { kind: 'append'; bundleId: string } | { kind: 'new'; reason: string }
  bundles: { id: string; intent: string; captureCount: number }[]
}

contextBridge.exposeInMainWorld('hive', {
  appName: APP_NAME,
  bundleId: BUNDLE_ID,

  onPending: (fn: (view: PendingView) => void) =>
    ipcRenderer.on('capture:pending', (_e, view: PendingView) => fn(view)),

  commit: (payload: { note: string; target: unknown; copyPointer: boolean }) =>
    ipcRenderer.invoke('capture:commit', payload),

  discard: () => ipcRenderer.invoke('capture:discard'),

  onFailed: (fn: (payload: unknown) => void) =>
    ipcRenderer.on('capture:failed', (_e, payload: unknown) => fn(payload)),
  retry: () => ipcRenderer.invoke('capture:retry'),
  wholeScreen: () => ipcRenderer.invoke('capture:whole-screen'),
  openSettings: (pane: string) => ipcRenderer.invoke('capture:open-settings', pane),

  onRegionBounds: (fn: (bounds: unknown) => void) =>
    ipcRenderer.on('region:bounds', (_e, bounds: unknown) => fn(bounds)),
  pickRegion: (rect: unknown) => ipcRenderer.invoke('region:pick', rect),
  cancelRegion: () => ipcRenderer.invoke('region:cancel'),

  catalogue: {
    list: () => ipcRenderer.invoke('catalogue:list'),
    get: (id: string) => ipcRenderer.invoke('catalogue:get', id),
    editNote: (id: string, index: number, note: string) =>
      ipcRenderer.invoke('catalogue:edit-note', { id, index, note }),
    editIntent: (id: string, intent: string) =>
      ipcRenderer.invoke('catalogue:edit-intent', { id, intent }),
    deleteCapture: (id: string, index: number) =>
      ipcRenderer.invoke('catalogue:delete-capture', { id, index }),
    moveCapture: (from: string, index: number, to: string | null) =>
      ipcRenderer.invoke('catalogue:move-capture', { from, index, to }),
    closeBundle: (id: string) => ipcRenderer.invoke('catalogue:close-bundle', id),
    reopenBundle: (id: string) => ipcRenderer.invoke('catalogue:reopen-bundle', id),
    handoff: (id: string, adapterId: string) =>
      ipcRenderer.invoke('catalogue:handoff', { id, adapterId }),
    adapters: () => ipcRenderer.invoke('catalogue:adapters'),
    onRefresh: (fn: () => void) => ipcRenderer.on('catalogue:refresh', () => fn()),
  },
})
