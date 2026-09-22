/**
 * Handoff: moving a Bundle to something that will act on it.
 *
 * The core knows the Adapter *interface* and never knows what any particular
 * destination is. HiveOp arrives later through this same interface — if it ever
 * needs a special case in here, the product is no longer agnostic and that is a
 * design regression, not an implementation detail.
 *
 * Platform capabilities (revealing a folder, writing the clipboard) are
 * injected rather than imported, which is what keeps this module free of
 * Electron and fully testable.
 */

import { join } from 'node:path'
import type { Bundle } from './bundleStore.ts'

export interface HandoffTarget {
  bundle: Bundle
  /** Absolute path to the Bundle's directory. */
  directory: string
  /** The one-line text pointer for this Bundle. */
  pointer: string
}

export interface HandoffAdapter {
  id: string
  /** The button: a short verb. */
  label: string
  /** One line under the button saying what it does, for someone who has never used it. */
  description: string
  /** Shown on the button for a moment after it worked, e.g. "Copied". */
  done: string
  handoff(target: HandoffTarget): Promise<void>
}

/** What the UI is told about an adapter: its words, never how it works. */
export type AdapterInfo = Pick<HandoffAdapter, 'id' | 'label' | 'description' | 'done'>

/**
 * The one-line pointer the capture bar copies (Cmd + Enter).
 *
 * Self-describing on purpose: any agent that can read a file can act on it
 * with no knowledge of HiveAnnotate. The first version was "use hive bundle
 * <id>", which meant something only to an agent built alongside this project —
 * a direct contradiction of the product being agent-agnostic. It is text, never
 * an image: a terminal cannot paste an image.
 */
export function bundlePointer(id: string, directory: string): string {
  return (
    `Take a look at HiveAnnotate bundle ${id}: screenshots of a problem, with my notes on what needs doing. ` +
    `Read ${join(directory, 'bundle.md')} first. It describes each screenshot, and the image files are in the same folder.`
  )
}

/**
 * The bundle id named by a pointer, in either the current format or the
 * original "use hive bundle <id>" one — old pointers live on in clipboards and
 * chat history and must keep resolving.
 */
export function parseBundlePointer(text: string): string | null {
  const match =
    text.match(/HiveAnnotate bundle\s+([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+)/i) ??
    text.match(/use hive bundle\s+([0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]+)/i)
  return match?.[1] ?? null
}

export function createFolderAdapter(deps: { reveal: (path: string) => void }): HandoffAdapter {
  return {
    id: 'folder',
    label: 'Open folder',
    description: 'See the screenshots and notes as files.',
    done: 'Opened',
    handoff: async (target) => {
      deps.reveal(target.directory)
    },
  }
}

export function createClipboardAdapter(deps: {
  writeText: (text: string) => void
}): HandoffAdapter {
  return {
    id: 'clipboard',
    // Matches the capture bar's 'save + copy prompt'. Not "link": what it
    // copies is a sentence for an AI, and calling it a link confused people.
    label: 'Copy prompt',
    description: 'Paste it into Claude Code, Codex, Cursor or any AI that can read files on this computer. It points the AI at the screenshots and notes.',
    done: 'Copied — now paste it into your AI',
    handoff: async (target) => {
      deps.writeText(target.pointer)
    },
  }
}

/** Thrown when a destination fails, naming which one, so the UI can say so. */
export class HandoffError extends Error {
  readonly adapterId: string

  constructor(adapterId: string, cause: unknown) {
    super(`handoff via "${adapterId}" failed`, { cause })
    this.name = 'HandoffError'
    this.adapterId = adapterId
  }
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, HandoffAdapter>()

  register(adapter: HandoffAdapter): void {
    if (this.adapters.has(adapter.id)) {
      throw new Error(`an adapter with id "${adapter.id}" is already registered`)
    }
    this.adapters.set(adapter.id, adapter)
  }

  list(): AdapterInfo[] {
    return [...this.adapters.values()].map(({ id, label, description, done }) => ({ id, label, description, done }))
  }

  async handoff(adapterId: string, target: HandoffTarget): Promise<void> {
    const adapter = this.adapters.get(adapterId)
    if (!adapter) throw new Error(`no handoff adapter registered with id "${adapterId}"`)

    try {
      await adapter.handoff(target)
    } catch (cause) {
      // A failed handoff costs the handoff, never the Bundle: nothing here
      // mutates stored state, so the work survives and the UI can retry.
      throw new HandoffError(adapterId, cause)
    }
  }
}
