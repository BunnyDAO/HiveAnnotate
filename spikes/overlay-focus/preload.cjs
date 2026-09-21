const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('spike', {
  dismiss: () => ipcRenderer.invoke('dismiss'),
  typed: (count) => ipcRenderer.invoke('typed', count),
  onShown: (fn) => ipcRenderer.on('shown', (_e, data) => fn(data)),
  onReport: (fn) => ipcRenderer.on('report', (_e, data) => fn(data)),
})
