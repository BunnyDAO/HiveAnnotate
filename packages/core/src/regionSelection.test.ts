import { describe, it, expect } from 'vitest'
import { GRID_KEYS, RegionSelection } from './regionSelection.ts'

const SCREEN = { x: 0, y: 0, width: 1800, height: 1169 }

/** Drives the picker: a letter marks, '_' descends. */
function press(...keys: string[]): RegionSelection {
  let sel = new RegionSelection(SCREEN)
  for (const key of keys) {
    if (key === '_') {
      sel = sel.descend()
      continue
    }
    const next = sel.toggle(key)
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
    expect(new RegionSelection(SCREEN).toggle('k')).toBeNull()
  })

  it('accepts the key whatever its case', () => {
    expect(press('Q').rect).toEqual(press('q').rect)
  })

  it('starts with the whole area selected, so ⏎ alone is a full capture', () => {
    expect(new RegionSelection(SCREEN).rect).toEqual(SCREEN)
  })
})

describe('one letter anchors', () => {
  it('selects the top-left ninth for q', () => {
    expect(press('q').rect).toEqual({ x: 0, y: 0, width: 600, height: 390 })
  })

  it('selects the middle ninth for s', () => {
    expect(press('s').rect).toEqual({ x: 600, y: 390, width: 600, height: 389 })
  })
})

describe('later letters extend the box', () => {
  it('q then e is exactly the top row', () => {
    expect(press('q', 'e').rect).toEqual({ x: 0, y: 0, width: 1800, height: 390 })
  })

  it('q then c is exactly the whole area', () => {
    expect(press('q', 'c').rect).toEqual(SCREEN)
  })

  it('w then x is the middle column, full height', () => {
    const rect = press('w', 'x').rect
    expect(rect.x).toBe(600)
    expect(rect.width).toBe(600)
    expect(rect.y).toBe(0)
    expect(rect.y + rect.height).toBe(SCREEN.height)
  })

  it('is order independent — the box is the same either way round', () => {
    expect(press('q', 'c').rect).toEqual(press('c', 'q').rect)
    expect(press('e', 'z').rect).toEqual(press('z', 'e').rect)
  })

  it('pressing a marked letter again unmarks it', () => {
    // q, e, then e again: back to just q.
    expect(press('q', 'e', 'e').rect).toEqual(press('q').rect)
  })

  it('unmarking a middle cell shrinks the box to the rest', () => {
    const sel = press('q', 'e', 'c', 'c')
    expect(sel.rect).toEqual(press('q', 'e').rect)
  })

  it('unmarking the only cell returns to the whole grid', () => {
    const sel = press('s', 's')
    expect(sel.rect).toEqual(SCREEN)
    expect(GRID_KEYS.some((_, i) => sel.isMarked(i))).toBe(false)
  })

  it('an unmark is undone by ⌫ like any other key', () => {
    expect(press('q', 'e', 'e').back().rect).toEqual(press('q', 'e').rect)
  })

  it('reaches a shape subdivision could not: the left two thirds', () => {
    // Not a ninth of anything — the case that motivated hive-v1-17.
    const rect = press('q', 'x').rect
    expect(rect).toEqual({ x: 0, y: 0, width: 1200, height: 1169 })
  })
})

describe('␣ descends', () => {
  it('makes the current box the new grid and clears the marks', () => {
    const descended = press('s', '_')
    expect(descended.rect).toEqual(press('s').rect)
    expect(GRID_KEYS.some((_, i) => descended.isMarked(i))).toBe(false)
  })

  it('reaches the same rectangle two subdivisions used to', () => {
    // Under hive-v1-12 this was `s` then `d`. One extra keystroke buys the
    // ability to select wide shapes at all.
    expect(press('s', '_', 'd').rect).toEqual({ x: 1000, y: 520, width: 200, height: 129 })
  })

  it('does nothing when nothing is marked yet', () => {
    const top = new RegionSelection(SCREEN)
    expect(top.descend().rect).toEqual(SCREEN)
  })

  it('refuses to descend past the point of usefulness', () => {
    let sel = new RegionSelection(SCREEN)
    for (let i = 0; i < 12; i++) sel = sel.toggle('q')!.descend()
    expect(sel.rect.width).toBeGreaterThan(1)
    expect(sel.rect.height).toBeGreaterThan(1)
  })
})

describe('⌫ undoes one key at a time', () => {
  it('undoes a mark', () => {
    expect(press('q', 'e').back().rect).toEqual(press('q').rect)
  })

  it('undoes a descend', () => {
    expect(press('s', '_').back().rect).toEqual(press('s').rect)
  })

  it('walks back through marks and descents in the order they were made', () => {
    const sel = press('s', '_', 'd')
    expect(sel.back().rect).toEqual(press('s', '_').rect)
    expect(sel.back().back().rect).toEqual(press('s').rect)
    expect(sel.back().back().back().rect).toEqual(SCREEN)
  })

  it('does nothing at the very start rather than throwing', () => {
    expect(new RegionSelection(SCREEN).back().rect).toEqual(SCREEN)
  })
})

describe('no cumulative drift', () => {
  it.each([0, 1, 2, 3])('the nine cells tile the grid exactly after %i descents', (descents) => {
    let sel = new RegionSelection(SCREEN)
    for (let i = 0; i < descents; i++) sel = sel.toggle('s')!.descend()

    const area = sel.cells().reduce((sum, c) => sum + c.width * c.height, 0)
    expect(area).toBe(sel.rect.width * sel.rect.height)
  })

  it('leaves no gap or overlap between neighbouring cells', () => {
    const cells = new RegionSelection(SCREEN).cells()
    expect(cells[0]!.x + cells[0]!.width).toBe(cells[1]!.x)
    expect(cells[0]!.y + cells[0]!.height).toBe(cells[3]!.y)
  })

  it('stays inside the screen however deep it goes', () => {
    let sel = new RegionSelection(SCREEN)
    for (let i = 0; i < 4; i++) sel = sel.toggle('c')!.descend()
    const r = sel.rect
    expect(r.x).toBeGreaterThanOrEqual(SCREEN.x)
    expect(r.x + r.width).toBeLessThanOrEqual(SCREEN.x + SCREEN.width)
    expect(r.y + r.height).toBeLessThanOrEqual(SCREEN.y + SCREEN.height)
  })
})

describe('⇧ + arrows — nudge an edge', () => {
  it('extends the right edge', () => {
    const sel = press('s')
    expect(sel.nudge('right').rect.width).toBe(sel.rect.width + 8)
  })

  it('extends left by moving the origin, not the far edge', () => {
    const sel = press('s')
    const nudged = sel.nudge('left')
    expect(nudged.rect.x).toBe(sel.rect.x - 8)
    expect(nudged.rect.x + nudged.rect.width).toBe(sel.rect.x + sel.rect.width)
  })

  it('clamps at the screen edge', () => {
    let sel = press('q')
    for (let i = 0; i < 200; i++) sel = sel.nudge('left')
    expect(sel.rect.x).toBe(SCREEN.x)
  })

  it('is undone by ⌫ like any other key', () => {
    const sel = press('s')
    expect(sel.nudge('right').back().rect).toEqual(sel.rect)
  })

  it('is superseded by the next letter, which redefines the box', () => {
    const nudged = press('q').nudge('right').nudge('right')
    expect(nudged.toggle('e')!.rect).toEqual(press('q', 'e').rect)
  })
})

describe('the rectangle handed to screencapture', () => {
  it('is integral, because -R takes no fractions', () => {
    const rect = press('s', '_', 'd', 'x').rect
    for (const value of Object.values(rect)) expect(Number.isInteger(value)).toBe(true)
  })

  it('works on a display that does not start at the origin', () => {
    const secondary = { x: 1800, y: -200, width: 1440, height: 900 }
    const sel = new RegionSelection(secondary).toggle('q')!
    expect(sel.rect).toEqual({ x: 1800, y: -200, width: 480, height: 300 })
  })
})
