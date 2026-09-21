/**
 * Shows an Electron accelerator ("Alt+1") the way a Mac user says it
 * ("Option + 1").
 *
 * Electron's syntax says Alt, but the key on a Mac says Option — the user was
 * sent looking for a key they do not have. A first fix rendered the macOS
 * symbols (⌥1), and the user then said the symbols were not clear either, so
 * shortcuts are spelled out in words.
 */

const MODIFIERS: Record<string, string> = {
  control: 'Control',
  ctrl: 'Control',
  alt: 'Option',
  option: 'Option',
  shift: 'Shift',
  command: 'Cmd',
  cmd: 'Cmd',
  commandorcontrol: 'Cmd',
  cmdorctrl: 'Cmd',
  super: 'Cmd',
  meta: 'Cmd',
}

/** The order macOS always lists modifiers in: Control, Option, Shift, Command. */
const ORDER = ['Control', 'Option', 'Shift', 'Cmd']

const KEYS: Record<string, string> = {
  enter: 'Enter',
  return: 'Enter',
  escape: 'Esc',
  esc: 'Esc',
  tab: 'Tab',
  backspace: 'Delete',
  delete: 'Forward Delete',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  space: 'Space',
}

export function formatAccelerator(accelerator: string): string {
  const parts = accelerator.split('+').map((p) => p.trim()).filter(Boolean)
  const modifiers = new Set<string>()
  let key = ''

  for (const part of parts) {
    const word = MODIFIERS[part.toLowerCase()]
    if (word) modifiers.add(word)
    else key = KEYS[part.toLowerCase()] ?? part.toUpperCase()
  }

  return [...ORDER.filter((m) => modifiers.has(m)), key].filter(Boolean).join(' + ')
}
