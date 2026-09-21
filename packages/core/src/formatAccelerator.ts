/**
 * Shows an Electron accelerator ("Alt+1") the way a Mac user reads it ("⌥1").
 *
 * Electron's accelerator syntax says Alt, but the key on a Mac keyboard says
 * Option and is drawn as ⌥ everywhere in macOS. Showing "Alt+1" in the menu
 * bar sent the user looking for a key they do not have.
 */

const MODIFIERS: Record<string, string> = {
  control: '⌃',
  ctrl: '⌃',
  alt: '⌥',
  option: '⌥',
  shift: '⇧',
  command: '⌘',
  cmd: '⌘',
  commandorcontrol: '⌘',
  cmdorctrl: '⌘',
  super: '⌘',
  meta: '⌘',
}

/** The order macOS menus always use: Control, Option, Shift, Command. */
const ORDER = ['⌃', '⌥', '⇧', '⌘']

const KEYS: Record<string, string> = {
  enter: '↩',
  return: '↩',
  escape: '⎋',
  esc: '⎋',
  tab: '⇥',
  backspace: '⌫',
  delete: '⌦',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
  space: 'Space',
}

export function formatAccelerator(accelerator: string): string {
  const parts = accelerator.split('+').map((p) => p.trim()).filter(Boolean)
  const modifiers = new Set<string>()
  let key = ''

  for (const part of parts) {
    const symbol = MODIFIERS[part.toLowerCase()]
    if (symbol) modifiers.add(symbol)
    else key = KEYS[part.toLowerCase()] ?? part.toUpperCase()
  }

  return ORDER.filter((m) => modifiers.has(m)).join('') + key
}
