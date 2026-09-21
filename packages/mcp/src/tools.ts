/**
 * What an agent can ask for. Depends on BundleStore alone — no MCP types here,
 * so the behaviour is testable without a transport.
 */

import { BundleStore } from '@hiveannotate/core'
import { join, isAbsolute } from 'node:path'

export interface ListedBundle {
  id: string
  intent: string
  captureCount: number
  createdAt: string
  damaged?: true
}

export interface CaptureForAgent {
  file: string
  /** Absolute. An agent reads the image straight off disk — no drag and drop. */
  path: string
  note: string
  kind: string
  app?: string
  width: number
  height: number
}

export interface BundleForAgent {
  id: string
  intent: string
  status: string
  createdAt: string
  captures: CaptureForAgent[]
}

export class BundleTools {
  private readonly store: BundleStore
  private readonly root: string

  constructor(root: string) {
    this.root = root
    this.store = new BundleStore(root)
  }

  /** Open bundles, newest first. Closed ones are done and would be noise. */
  async listBundles(): Promise<ListedBundle[]> {
    const all = await this.store.listBundles()
    return all
      .filter((b) => b.damaged || b.status === 'open')
      .map((b) => ({
        id: b.id,
        intent: b.intent,
        captureCount: b.captureCount,
        createdAt: b.createdAt,
        ...(b.damaged ? { damaged: true as const } : {}),
      }))
  }

  async getBundle(id: string): Promise<BundleForAgent> {
    const bundle = await this.store.getBundle(id)

    return {
      id: bundle.id,
      intent: bundle.intent,
      status: bundle.status,
      createdAt: bundle.createdAt,
      captures: bundle.captures.map((c) => {
        const path = join(this.root, bundle.id, c.file)
        /* c8 ignore next */
        if (!isAbsolute(path)) throw new Error(`refusing to hand back a relative path: ${path}`)
        return {
          file: c.file,
          path,
          note: c.note,
          kind: c.kind,
          ...(c.app === undefined ? {} : { app: c.app }),
          width: c.width,
          height: c.height,
        }
      }),
    }
  }

  async closeBundle(id: string): Promise<{ id: string; status: string }> {
    const closed = await this.store.closeBundle(id)
    return { id: closed.id, status: closed.status }
  }
}
