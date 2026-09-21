/**
 * Picking an arbitrary rectangle with the keyboard.
 *
 * The screen is a 3×3 grid on the home-row block; pressing a key subdivides
 * that cell into another 3×3. Two keystrokes reach a small rectangle, and more
 * refine it. No mouse is involved at any point, which is the whole reason this
 * exists: `screencapture -i` requires a drag, so the OS picker is unusable.
 *
 * Pure geometry, so every level of subdivision is testable without a screen.
 */

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Left to right, top to bottom, on the home-row block. */
export const GRID_KEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'] as const

const COLUMNS = 3
const ROWS = 3
const NUDGE_PX = 8
/** Below this a cell is no longer a selection anyone meant to make. */
const MIN_SIDE = 8

export class RegionSelection {
  private readonly bounds: Rect
  private readonly history: Rect[]

  constructor(bounds: Rect, history: Rect[] = []) {
    this.bounds = bounds
    this.history = history
  }

  get rect(): Rect {
    return this.bounds
  }

  /** How many times the screen has been subdivided to get here. */
  get depth(): number {
    return this.history.length
  }

  /** The nine cells of the current rectangle, in key order. */
  cells(): Rect[] {
    return GRID_KEYS.map((_, index) => this.cellAt(index))
  }

  subdivide(key: string): RegionSelection | null {
    const index = GRID_KEYS.indexOf(key.toLowerCase() as (typeof GRID_KEYS)[number])
    if (index === -1) return null

    const cell = this.cellAt(index)
    if (cell.width < MIN_SIDE || cell.height < MIN_SIDE) return null

    return new RegionSelection(cell, [...this.history, this.bounds])
  }

  /** ⌫ — undo the last subdivision. */
  back(): RegionSelection {
    const parent = this.history[this.history.length - 1]
    if (!parent) return this
    return new RegionSelection(parent, this.history.slice(0, -1))
  }

  /**
   * ␣ — enlarge around the current rectangle, keeping its depth.
   *
   * Distinct from ⌫, which jumps back to a rectangle nine times the size. This
   * is the fine adjustment: the selection is nearly right and wants a little
   * more room.
   */
  grow(): RegionSelection {
    const outer = this.outerBounds()
    const dx = Math.max(1, Math.round(this.bounds.width / COLUMNS))
    const dy = Math.max(1, Math.round(this.bounds.height / ROWS))

    return this.withRect(
      clampTo(
        {
          x: this.bounds.x - dx,
          y: this.bounds.y - dy,
          width: this.bounds.width + dx * 2,
          height: this.bounds.height + dy * 2,
        },
        outer,
      ),
    )
  }

  /** ⇧ + arrow — extend one edge outwards. */
  nudge(direction: 'left' | 'right' | 'up' | 'down'): RegionSelection {
    const outer = this.outerBounds()
    const r = { ...this.bounds }

    // Left and up move the origin and keep the far edge where it is, so the
    // rectangle grows in the direction pressed rather than sliding.
    if (direction === 'left') {
      r.x -= NUDGE_PX
      r.width += NUDGE_PX
    } else if (direction === 'up') {
      r.y -= NUDGE_PX
      r.height += NUDGE_PX
    } else if (direction === 'right') {
      r.width += NUDGE_PX
    } else {
      r.height += NUDGE_PX
    }

    return this.withRect(clampTo(r, outer))
  }

  private withRect(rect: Rect): RegionSelection {
    return new RegionSelection(rect, this.history)
  }

  /** The full screen this selection started from. */
  private outerBounds(): Rect {
    return this.history[0] ?? this.bounds
  }

  /**
   * Cell edges are derived from the parent rectangle every time rather than by
   * repeatedly flooring a cell size. Flooring drifts: four levels in, the
   * selection no longer matches what was drawn on screen.
   */
  private cellAt(index: number): Rect {
    const column = index % COLUMNS
    const row = Math.floor(index / COLUMNS)

    const x0 = this.bounds.x + Math.round((column * this.bounds.width) / COLUMNS)
    const x1 = this.bounds.x + Math.round(((column + 1) * this.bounds.width) / COLUMNS)
    const y0 = this.bounds.y + Math.round((row * this.bounds.height) / ROWS)
    const y1 = this.bounds.y + Math.round(((row + 1) * this.bounds.height) / ROWS)

    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
  }
}

function clampTo(rect: Rect, outer: Rect): Rect {
  const x = Math.max(outer.x, rect.x)
  const y = Math.max(outer.y, rect.y)
  const right = Math.min(outer.x + outer.width, rect.x + rect.width)
  const bottom = Math.min(outer.y + outer.height, rect.y + rect.height)

  return { x, y, width: Math.max(MIN_SIDE, right - x), height: Math.max(MIN_SIDE, bottom - y) }
}
