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

  commit: (payload: { note: string; targetIndex: number; copyPointer: boolean }) =>
    ipcRenderer.invoke('capture:commit', payload),

  discard: () => ipcRenderer.invoke('capture:discard'),

  onRegionBounds: (fn: (bounds: unknown) => void) =>
    ipcRenderer.on('region:bounds', (_e, bounds: unknown) => fn(bounds)),
  pickRegion: (rect: unknown) => ipcRenderer.invoke('region:pick', rect),
  cancelRegion: () => ipcRenderer.invoke('region:cancel'),
})
