import { describe, it, expect } from 'vitest'
import { GRID_KEYS, RegionSelection } from './regionSelection.ts'

const SCREEN = { x: 0, y: 0, width: 1800, height: 1169 }

function at(...keys: string[]): RegionSelection {
  let sel = new RegionSelection(SCREEN)
  for (const key of keys) {
    const next = sel.subdivide(key)
    if (!next) throw new Error(`key ${key} was rejected`)
    sel = next
  }
  return sel
}

describe('the grid', () => {
  it('is the home row block, reading left to right and top to bottom', () => {
    expect(GRID_KEYS).toEqual(['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'])
  })

  it('ignores a key that is not on the grid', () => {
    expect(new RegionSelection(SCREEN).subdivide('k')).toBeNull()
  })

  it('accepts the key whatever its case', () => {
    expect(at('Q').rect).toEqual(at('q').rect)
  })
})

describe('subdividing', () => {
  it('puts q in the top-left ninth', () => {
    expect(at('q').rect).toEqual({ x: 0, y: 0, width: 600, height: 390 })
  })

  it('puts s in the middle ninth', () => {
    expect(at('s').rect).toEqual({ x: 600, y: 390, width: 600, height: 389 })
  })

  it('puts c in the bottom-right ninth, flush with the far edge', () => {
    const { x, y, width, height } = at('c').rect
    expect(x + width).toBe(SCREEN.width)
    expect(y + height).toBe(SCREEN.height)
  })

  it('reaches a small rectangle in two keystrokes', () => {
    // s is the middle ninth; d is the middle row, right column *of that* — so
    // the y origin moves down into the sub-cell, not back to the parent's top.
    expect(at('s', 'd').rect).toEqual({ x: 1000, y: 520, width: 200, height: 129 })
  })

  it('tracks how deep it has gone', () => {
    expect(at('s').depth).toBe(1)
    expect(at('s', 'd', 'q').depth).toBe(3)
  })
})

describe('no cumulative drift', () => {
  // Cell edges are computed from the parent rectangle each time rather than by
  // repeatedly flooring a cell size. Without that, four levels of subdivision
  // drift by several pixels and the selection stops matching what is drawn.
  it.each([1, 2, 3, 4])('the nine cells tile the parent exactly at depth %i', (depth) => {
    let parent = new RegionSelection(SCREEN)
    for (let i = 1; i < depth; i++) parent = parent.subdivide('s')!

    const cells = GRID_KEYS.map((k) => parent.subdivide(k)!.rect)
    const area = cells.reduce((sum, c) => sum + c.width * c.height, 0)

    expect(area).toBe(parent.rect.width * parent.rect.height)
  })

  it('leaves no gap or overlap between neighbouring cells', () => {
    const parent = new RegionSelection(SCREEN)
    const q = parent.subdivide('q')!.rect
    const w = parent.subdivide('w')!.rect
    const a = parent.subdivide('a')!.rect

    expect(q.x + q.width).toBe(w.x)
    expect(q.y + q.height).toBe(a.y)
  })

  it('stays inside the screen however deep it goes', () => {
    const deep = at('c', 'c', 'c', 'c').rect
    expect(deep.x).toBeGreaterThanOrEqual(SCREEN.x)
    expect(deep.y).toBeGreaterThanOrEqual(SCREEN.y)
    expect(deep.x + deep.width).toBeLessThanOrEqual(SCREEN.x + SCREEN.width)
    expect(deep.y + deep.height).toBeLessThanOrEqual(SCREEN.y + SCREEN.height)
  })

  it('refuses to subdivide past the point of usefulness', () => {
    let sel = new RegionSelection(SCREEN)
    for (let i = 0; i < 12; i++) {
      const next = sel.subdivide('q')
      if (!next) break
      sel = next
    }
    // A one-pixel target is not a selection anyone meant to make.
    expect(sel.rect.width).toBeGreaterThan(1)
    expect(sel.rect.height).toBeGreaterThan(1)
  })
})

describe('⌫ — back one level', () => {
  it('returns to the parent rectangle', () => {
    expect(at('s', 'd').back().rect).toEqual(at('s').rect)
  })

  it('does nothing at the top level rather than throwing', () => {
    const top = new RegionSelection(SCREEN)
    expect(top.back().rect).toEqual(SCREEN)
  })

  it('undoes exactly one level at a time', () => {
    expect(at('s', 'd', 'q').back().back().rect).toEqual(at('s').rect)
  })
})

describe('␣ — grow', () => {
  // Distinct from ⌫: growing keeps the selection where it is and enlarges it by
  // one cell on every side. ⌫ jumps back to a rectangle nine times the size.
  it('enlarges around the current rectangle without changing depth', () => {
    const sel = at('s', 's')
    const grown = sel.grow()

    expect(grown.depth).toBe(sel.depth)
    expect(grown.rect.width).toBeGreaterThan(sel.rect.width)
    expect(grown.rect.x).toBeLessThan(sel.rect.x)
  })

  it('clamps at the screen edge instead of running off it', () => {
    let sel = at('q')
    for (let i = 0; i < 20; i++) sel = sel.grow()

    expect(sel.rect.x).toBe(SCREEN.x)
    expect(sel.rect.y).toBe(SCREEN.y)
    expect(sel.rect.width).toBeLessThanOrEqual(SCREEN.width)
  })
})

describe('⇧ + arrows — nudge an edge', () => {
  it.each([
    ['right', { width: 8 }],
    ['down', { height: 8 }],
  ])('extends the %s edge', (direction, delta) => {
    const sel = at('s')
    const nudged = sel.nudge(direction as 'right' | 'down')

    if ('width' in delta) expect(nudged.rect.width).toBe(sel.rect.width + delta.width)
    if ('height' in delta) expect(nudged.rect.height).toBe(sel.rect.height + delta.height!)
  })

  it('extends left and up by moving the origin, not the far edge', () => {
    const sel = at('s')
    const nudged = sel.nudge('left')

    expect(nudged.rect.x).toBe(sel.rect.x - 8)
    expect(nudged.rect.x + nudged.rect.width).toBe(sel.rect.x + sel.rect.width)
  })

  it('clamps at the screen edge', () => {
    let sel = at('q')
    for (let i = 0; i < 200; i++) sel = sel.nudge('left')
    expect(sel.rect.x).toBe(SCREEN.x)
  })
})

describe('the rectangle handed to screencapture', () => {
  it('is integral, because -R takes no fractions', () => {
    const rect = at('s', 'd', 'x').rect
    for (const value of Object.values(rect)) expect(Number.isInteger(value)).toBe(true)
  })

  it('works on a display that does not start at the origin', () => {
    // A secondary display sits at a non-zero offset in the global coordinate
    // space, which is the space -R expects.
    const secondary = { x: 1800, y: -200, width: 1440, height: 900 }
    const sel = new RegionSelection(secondary).subdivide('q')!

    expect(sel.rect).toEqual({ x: 1800, y: -200, width: 480, height: 300 })
  })
})
