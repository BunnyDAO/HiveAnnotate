import { shell, clipboard } from 'electron'
import {
  AdapterRegistry,
  createClipboardAdapter,
  createFolderAdapter,
} from '@hiveannotate/core'

/**
 * The only place Electron's capabilities meet the handoff system. Everything
 * that decides anything lives in core; this just supplies the platform calls.
 */
export function buildAdapterRegistry(): AdapterRegistry {
  const registry = new AdapterRegistry()

  registry.register(createFolderAdapter({ reveal: (path) => shell.openPath(path) }))
  registry.register(createClipboardAdapter({ writeText: (text) => clipboard.writeText(text) }))

  return registry
}
