import type { FilingTarget } from '@hiveannotate/core/filingChoices'

/** The single declaration of what preload exposes on the window. */

export interface Destination {
  kind: 'append' | 'new'
  bundleId?: string
  reason?: string
}

export interface PendingView {
  isRetry?: boolean
  kind: string
  app: string | null
  width: number
  height: number
  destination: Destination
  bundles: { id: string; intent: string; captureCount: number }[]
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface FailureExplanation {
  title: string
  detail: string
  retryLabel: string
  alternative?: string
  settingsPane?: string
  blocking: boolean
}

export interface FailurePayload {
  reason: string
  explanation: FailureExplanation
}

export interface BundleSummary {
  id: string
  intent: string
  status: string
  createdAt: string
  captureCount: number
  damaged?: true
}

export interface CaptureView {
  index: number
  file: string
  src: string
  note: string
  kind: string
  app?: string
  width: number
  height: number
  takenAt: string
}

export interface BundleView {
  id: string
  intent: string
  status: string
  createdAt: string
  captures: CaptureView[]
  pointer: string
}

export interface CatalogueBridge {
  list: () => Promise<BundleSummary[]>
  get: (id: string) => Promise<BundleView>
  editNote: (id: string, index: number, note: string) => Promise<unknown>
  editIntent: (id: string, intent: string) => Promise<unknown>
  deleteCapture: (id: string, index: number) => Promise<unknown>
  moveCapture: (from: string, index: number, to: string | null) => Promise<unknown>
  closeBundle: (id: string) => Promise<unknown>
  reopenBundle: (id: string) => Promise<unknown>
  handoff: (id: string, adapterId: string) => Promise<unknown>
  adapters: () => Promise<{ id: string; label: string }[]>
  onRefresh?: (fn: () => void) => void
}

export interface HiveBridge {
  appName: string
  bundleId: string
  onPending?: (fn: (view: PendingView) => void) => void
  commit?: (p: { note: string; target: FilingTarget; copyPointer: boolean }) => Promise<unknown>
  discard?: () => Promise<unknown>
  onFailed?: (fn: (payload: FailurePayload) => void) => void
  retry?: () => Promise<unknown>
  wholeScreen?: () => Promise<unknown>
  openSettings?: (pane: string) => Promise<unknown>
  onRegionBounds?: (fn: (bounds: Rect) => void) => void
  catalogue?: CatalogueBridge
  pickRegion?: (rect: Rect) => Promise<unknown>
  cancelRegion?: () => Promise<unknown>
}

declare global {
  interface Window {
    hive?: HiveBridge
  }
}

export {}
