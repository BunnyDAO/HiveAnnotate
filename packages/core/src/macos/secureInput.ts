/**
 * Watches macOS Secure Input.
 *
 * While Secure Input is on, macOS withholds key events from every other app
 * system-wide. The hotkey never arrives, so the capture bar cannot appear to
 * explain itself — the menu-bar icon is the only surface left. There is no
 * app-side workaround; the honest response is to say so, and to say *which app*
 * is holding it, because "hotkeys blocked" alone gives the user nothing to act
 * on.
 *
 * Polled rather than observed because the state publishes no notification. The
 * probe is injected, which keeps this testable and free of native code.
 */

export interface SecureInputState {
  enabled: boolean
  /**
   * The app macOS attributes it to. This is the *responsible* app: a password
   * prompt inside a terminal is reported as the terminal.
   */
  holder?: string
}

export interface SecureInputWatcherOptions {
  probe: () => Promise<SecureInputState | boolean>
  intervalMs?: number
}

export class SecureInputWatcher {
  private readonly probe: () => Promise<SecureInputState | boolean>
  private readonly intervalMs: number
  private readonly listeners = new Set<(state: SecureInputState) => void>()
  private timer: ReturnType<typeof setInterval> | null = null
  private last: string | null = null

  constructor(options: SecureInputWatcherOptions) {
    this.probe = options.probe
    // Fast enough that the indicator feels immediate, slow enough to be free.
    this.intervalMs = options.intervalMs ?? 500
  }

  onChange(listener: (state: SecureInputState) => void): () => void {
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
    let raw: SecureInputState | boolean
    try {
      raw = await this.probe()
    } catch {
      // A transient probe failure must not end the watch: the indicator would
      // freeze on a stale value and the app would look broken.
      return
    }

    const state: SecureInputState =
      typeof raw === 'boolean' ? { enabled: raw } : raw
    // A change of holder while still blocked is news too: the user needs the
    // name of whatever is holding it *now*.
    const key = `${state.enabled}|${state.holder ?? ''}`
    if (key === this.last) return
    this.last = key
    for (const listener of this.listeners) listener(state)
  }
}
