/**
 * The HiveAnnotate mark, defined once.
 *
 * HiveOp's outer hexagon (hiveop-landing/public/images/hiveop-logo.svg, on the
 * same 64-unit grid) with its inner hexagon replaced by four corner brackets —
 * a capture frame. Family resemblance to HiveOp at a glance; says "screenshot
 * tool" on its own.
 */

export const HEX = 'M32 4 L56 18 V46 L32 60 L8 46 V18 Z'
export const BRACKETS = 'M21 27 V22 H26 M38 22 H43 V27 M43 37 V42 H38 M26 42 H21 V37'

/** HiveOp's gradient, from its logo and icon. */
export const GRADIENT = ['#22d3ee', '#0ea5e9']

/** The full-colour mark on transparent, for use inside the app. */
export function markSvg({ size = 64, hexWidth = 3.5, bracketWidth = 3 } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="1" stop-color="${GRADIENT[1]}"/>
  </linearGradient></defs>
  <path d="${HEX}" stroke="url(#g)" stroke-width="${hexWidth}" stroke-linejoin="round"/>
  <path d="${BRACKETS}" stroke="url(#g)" stroke-width="${bracketWidth}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

/**
 * The macOS menu-bar template: pure black on transparent, which the system
 * recolours for light and dark menu bars. Strokes are heavier than the colour
 * mark because it is drawn at 16 points.
 */
export function templateSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <path d="${HEX}" stroke="#000" stroke-width="6" stroke-linejoin="round"/>
  <path d="${BRACKETS}" stroke="#000" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
}

/**
 * The 16px (non-Retina) template. At 16 pixels the four brackets blur into a
 * ring, so this size keeps the hexagon and replaces the brackets with a single
 * solid centre. Retina menu bars use the 32px template, which keeps them.
 */
export function templateSmallSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64" fill="none">
  <path d="${HEX}" stroke="#000" stroke-width="7" stroke-linejoin="round"/>
  <rect x="24" y="24" width="16" height="16" rx="3" fill="#000"/>
</svg>`
}

/** The app icon: HiveOp's navy tile, the mark centred on it. */
export function appIconSvg(size = 1024) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#0c1220"/><stop offset="1" stop-color="#06090f"/>
    </linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="1" stop-color="${GRADIENT[1]}"/>
    </linearGradient>
  </defs>
  <!-- macOS icon grid: an 824 tile inset 100 from each edge, corner radius ~185 -->
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#bg)"/>
  <rect x="100.5" y="100.5" width="823" height="823" rx="184.5" stroke="#1e293b" stroke-width="1"/>
  <g transform="translate(192 192) scale(10)">
    <path d="${HEX}" stroke="url(#g)" stroke-width="3.4" stroke-linejoin="round"/>
    <path d="${BRACKETS}" stroke="url(#g)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`
}
