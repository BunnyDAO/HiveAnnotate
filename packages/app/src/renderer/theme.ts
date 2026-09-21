/**
 * HiveAnnotate's palette, taken from HiveOp (hiveop-landing/tailwind.config.ts)
 * so the two read as one family.
 *
 * Changed from the original warm brown-and-honey scheme on the user's request
 * for something calmer: cool deep navy and slate, with soft blue accents.
 * Every surface reads its colours from here — nothing in a component should
 * hard-code a hex value.
 */

export const theme = {
  /** App background — HiveOp `background-light`. */
  background: '#0c1220',
  /** Panels, the capture bar, cards — HiveOp `surface`. */
  surface: '#111827',
  /** Raised elements: keycaps, buttons, selected rows — HiveOp `surface-light`. */
  surfaceRaised: '#1a2332',
  /** Hairlines — HiveOp `border`. */
  border: '#1e293b',
  /** Outlines on controls — HiveOp `border-light`. */
  borderStrong: '#334155',
  borderSelected: '#475569',

  text: '#e2e8f0',
  textBody: '#cbd5e1',
  /** Secondary text — HiveOp `muted`. */
  muted: '#94a3b8',
  /** Tertiary text — HiveOp `muted-dark`. */
  dim: '#64748b',

  /** Highlights, selection, the region frame — HiveOp `accent.blue`. */
  accent: '#38bdf8',
  accentRgb: '56, 189, 248',
  /** Solid buttons — HiveOp `primary`. */
  primary: '#3b82f6',
  /** HiveOp has no red; a soft one that sits in the slate palette. */
  danger: '#f87171',
  onDanger: '#0c1220',

  /** Dims everything outside the region picker's selection. */
  scrim: 'rgba(6, 9, 15, .45)',
  /** Behind the full-size screenshot viewer. */
  backdrop: 'rgba(6, 9, 15, .92)',
} as const

export const fonts = {
  /** HiveOp's sans. */
  sans: "'Inter', system-ui, sans-serif",
  /** HiveOp's mono. */
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const

/** The accent at a given opacity, for tints and glows. */
export function accentAlpha(alpha: number): string {
  return `rgba(${theme.accentRgb}, ${alpha})`
}
