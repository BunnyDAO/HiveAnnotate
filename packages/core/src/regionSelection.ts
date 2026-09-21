/**
 * Picking an arbitrary rectangle with the keyboard.
 *
 * The grid is the home-row block. **Letters mark cells and the selection is the
 * bounding box of everything marked** — the first press anchors, each later
 * press extends. That makes it a corner-to-corner drag done with the keyboard:
 * Q then C is the whole grid, Q then E is the top row.
 *
 * Precision comes from descending: ␣ makes the current box the new grid, so the
 * next letters subdivide it. S ␣ D reaches the same small rectangle that two
 * subdivisions used to.
 *
 * Pure geometry, so every level is testable without a screen.
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

interface State {
  /** The area currently divided into nine. */
  grid: Rect
  /** Indices of cells marked at this level. */
  marked: number[]
  /** Set by a nudge; cleared by the next mark, which redefines the box. */
  override: Rect | null
}

export class RegionSelection {
  private readonly state: State
  private readonly history: State[]

  constructor(bounds: Rect, state?: State, history: State[] = []) {
    this.state = state ?? { grid: bounds, marked: [], override: null }
    this.history = history
  }

  /** The rectangle that would be captured right now. */
  get rect(): Rect {
    if (this.state.override) return this.state.override
    if (this.state.marked.length === 0) return this.state.grid

    const cells = this.state.marked.map((i) => this.cellAt(i))
    const x = Math.min(...cells.map((c) => c.x))
    const y = Math.min(...cells.map((c) => c.y))
    const right = Math.max(...cells.map((c) => c.x + c.width))
    const bottom = Math.max(...cells.map((c) => c.y + c.height))

    return { x, y, width: right - x, height: bottom - y }
  }

  /** How many times the picker has descended. */
  get depth(): number {
    return this.history.filter((s) => s.marked.length > 0).length
  }

  /** The nine cells of the current grid, in key order. */
  cells(): Rect[] {
    return GRID_KEYS.map((_, index) => this.cellAt(index))
  }

  isMarked(index: number): boolean {
    return this.state.marked.includes(index)
  }

  /** A letter: anchor if first, otherwise extend the box to include this cell. */
  mark(key: string): RegionSelection | null {
    const index = GRID_KEYS.indexOf(key.toLowerCase() as (typeof GRID_KEYS)[number])
    if (index === -1) return null

    // A fresh mark redefines the box, so any nudge that came before is spent.
    const marked = this.state.marked.includes(index)
      ? this.state.marked
      : [...this.state.marked, index]

    return this.push({ grid: this.state.grid, marked, override: null })
  }

  /** ␣ — the current box becomes the new grid; the marks clear. */
  descend(): RegionSelection {
    if (this.state.marked.length === 0 && !this.state.override) return this
    const next = this.rect
    if (next.width < MIN_SIDE * COLUMNS || next.height < MIN_SIDE * ROWS) return this
    return this.push({ grid: next, marked: [], override: null })
  }

  /** ⌫ — undo exactly one key, whether it was a mark or a descend. */
  back(): RegionSelection {
    const previous = this.history[this.history.length - 1]
    if (!previous) return this
    return new RegionSelection(previous.grid, previous, this.history.slice(0, -1))
  }

  /** ⇧ + arrow — extend one edge of the resulting box outwards. */
  nudge(direction: 'left' | 'right' | 'up' | 'down'): RegionSelection {
    const outer = this.outerBounds()
    const r = { ...this.rect }

    // Left and up move the origin and keep the far edge, so the box grows in
    // the direction pressed rather than sliding.
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

    return this.push({ ...this.state, override: clampTo(r, outer) })
  }

  private push(state: State): RegionSelection {
    return new RegionSelection(state.grid, state, [...this.history, this.state])
  }

  /** The full screen this selection started from. */
  private outerBounds(): Rect {
    return this.history[0]?.grid ?? this.state.grid
  }

  /**
   * Cell edges are derived from the grid every time rather than by repeatedly
   * flooring a cell size. Flooring drifts: several levels in, the selection
   * stops matching what is drawn.
   */
  private cellAt(index: number): Rect {
    const { grid } = this.state
    const column = index % COLUMNS
    const row = Math.floor(index / COLUMNS)

    const x0 = grid.x + Math.round((column * grid.width) / COLUMNS)
    const x1 = grid.x + Math.round(((column + 1) * grid.width) / COLUMNS)
    const y0 = grid.y + Math.round((row * grid.height) / ROWS)
    const y1 = grid.y + Math.round(((row + 1) * grid.height) / ROWS)

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
