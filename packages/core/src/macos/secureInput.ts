/**
 * Watches macOS Secure Input.
 *
 * While a password field is focused, macOS withholds key events from every
 * other app system-wide. The hotkey never arrives, so the capture bar cannot
 * appear to explain itself — the menu-bar icon is the only surface left. There
 * is no app-side workaround; the only honest response is to say so.
 *
 * Polled rather than observed because the state has no notification. The probe
 * is injected, which keeps this testable and free of any native dependency.
 */

export interface SecureInputWatcherOptions {
  probe: () => Promise<boolean>
  intervalMs?: number
}

export class SecureInputWatcher {
  private readonly probe: () => Promise<boolean>
  private readonly intervalMs: number
  private readonly listeners = new Set<(enabled: boolean) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private last: boolean | null = null

  constructor(options: SecureInputWatcherOptions) {
    this.probe = options.probe
    // Fast enough that the indicator feels immediate, slow enough to be free.
    this.intervalMs = options.intervalMs ?? 500
  }

  onChange(listener: (enabled: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  start(): void {
    if (this.timer) return
    void this.poll()
    this.timer = setInterval(() => void this.poll(), this.intervalMs)
  }

  stop(): void {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  private async poll(): Promise<void> {
    let enabled: boolean
    try {
      enabled = await this.probe()
    } catch {
      // A transient probe failure must not end the watch: the indicator would
      // freeze on a stale value and the app would look broken.
      return
    }

    if (enabled === this.last) return
    this.last = enabled
    for (const listener of this.listeners) listener(enabled)
  }
}
