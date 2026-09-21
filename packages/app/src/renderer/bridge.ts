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

export interface HiveBridge {
  appName: string
  bundleId: string
  onPending?: (fn: (view: PendingView) => void) => void
  commit?: (p: { note: string; targetIndex: number; copyPointer: boolean }) => Promise<unknown>
  discard?: () => Promise<unknown>
  onFailed?: (fn: (payload: FailurePayload) => void) => void
  retry?: () => Promise<unknown>
  wholeScreen?: () => Promise<unknown>
  openSettings?: (pane: string) => Promise<unknown>
  onRegionBounds?: (fn: (bounds: Rect) => void) => void
  pickRegion?: (rect: Rect) => Promise<unknown>
  cancelRegion?: () => Promise<unknown>
}

declare global {
  interface Window {
    hive?: HiveBridge
  }
}

export {}
