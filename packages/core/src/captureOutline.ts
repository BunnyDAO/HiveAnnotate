/**
 * Where to draw the brief outline that shows what a capture just took.
 *
 * The region picker shows its selection before the shutter; a window or
 * whole-screen capture otherwise happens with no sign of what was caught. The
 * outline answers "did it get the right thing?" at a glance.
 *
 * All rects are in global display points, origin top-left of the main display.
 */

import type { CaptureTarget } from './macos/captureBackend.ts'
import type { Rect } from './regionSelection.ts'

export interface OutlineContext {
  /** Every display; the first is the main one, which a whole-screen capture takes. */
  displays: readonly Rect[]
  /** The captured window's bounds, when the target is a window. */
  windowBounds?: Rect
}

export function captureOutline(target: CaptureTarget, context: OutlineContext): Rect | null {
  switch (target.kind) {
    case 'region':
      return { x: target.x, y: target.y, width: target.width, height: target.height }
    case 'screen':
      return context.displays[0] ?? null
    case 'window': {
      // Unknown bounds get no outline: a box in the wrong place is worse than none.
      if (!context.windowBounds) return null
      // A window can hang off a screen edge. Clipped to the display holding most
      // of it, the whole outline stays where the user can see it.
      let best: Rect | null = null
      for (const display of context.displays) {
        const clipped = intersect(context.windowBounds, display)
        if (clipped && (!best || area(clipped) > area(best))) best = clipped
      }
      return best
    }
  }
}

function intersect(a: Rect, b: Rect): Rect | null {
  const x = Math.max(a.x, b.x)
  const y = Math.max(a.y, b.y)
  const right = Math.min(a.x + a.width, b.x + b.width)
  const bottom = Math.min(a.y + a.height, b.y + b.height)
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null
}

function area(r: Rect): number {
  return r.width * r.height
}
