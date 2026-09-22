/**
 * Shows an Electron accelerator the way the user's own keyboard names it.
 *
 *   formatAccelerator('CommandOrControl+Shift+1', 'darwin') → 'Cmd + Shift + 1'
 *   formatAccelerator('CommandOrControl+Shift+1', 'win32')  → 'Ctrl + Shift + 1'
 *
 * History: Electron's syntax says "Alt", which sent a Mac user looking for a
 * key their keyboard labels Option. Symbols (⌥1) were tried next and read as
 * unclear, so shortcuts are spelled out in words — in the platform's words.
 *
 * Zero imports, so the renderer can use it too; it passes its platform in.
 */

export type Platform = 'darwin' | 'win32' | 'linux' | string

type ModifierRole = 'control' | 'option' | 'shift' | 'command'

const ROLE_OF: Record<string, ModifierRole | 'commandOrControl'> = {
  control: 'control',
  ctrl: 'control',
  alt: 'option',
  option: 'option',
  shift: 'shift',
  command: 'command',
  cmd: 'command',
  super: 'command',
  meta: 'command',
  commandorcontrol: 'commandOrControl',
  cmdorctrl: 'commandOrControl',
}

const NAMES: Record<'mac' | 'other', Record<ModifierRole, string>> = {
  mac: { control: 'Control', option: 'Option', shift: 'Shift', command: 'Cmd' },
  other: { control: 'Ctrl', option: 'Alt', shift: 'Shift', command: 'Win' },
}

/**
 * The order shortcuts are *said* in. macOS menus draw glyphs as ⌃⌥⇧⌘, but
 * spelled out people say "Cmd + Shift + 4", so on a Mac Cmd leads. Windows
 * says "Ctrl + Shift + 1" already.
 */
const ORDER: Record<'mac' | 'other', ModifierRole[]> = {
  mac: ['command', 'control', 'option', 'shift'],
  other: ['control', 'option', 'shift', 'command'],
}

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

export function isMac(platform: Platform): boolean {
  return platform === 'darwin'
}

/** The everyday "command" key: Cmd on a Mac, Ctrl everywhere else. */
export function primaryModifierName(platform: Platform): string {
  return isMac(platform) ? 'Cmd' : 'Ctrl'
}

export function formatAccelerator(accelerator: string, platform: Platform = 'darwin'): string {
  const family = isMac(platform) ? 'mac' : 'other'
  const roles = new Set<ModifierRole>()
  let key = ''

  for (const part of accelerator.split('+').map((p) => p.trim()).filter(Boolean)) {
    const role = ROLE_OF[part.toLowerCase()]
    if (role === 'commandOrControl') roles.add(family === 'mac' ? 'command' : 'control')
    else if (role) roles.add(role)
    else key = KEYS[part.toLowerCase()] ?? part.toUpperCase()
  }

  const names = ORDER[family].filter((r) => roles.has(r)).map((r) => NAMES[family][r])
  return [...names, key].filter(Boolean).join(' + ')
}
