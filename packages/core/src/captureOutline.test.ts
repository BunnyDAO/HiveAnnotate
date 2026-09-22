import { describe, it, expect } from 'vitest'
import { captureOutline } from './captureOutline.ts'

const main = { x: 0, y: 0, width: 1512, height: 982 }
const right = { x: 1512, y: 0, width: 2560, height: 1440 }
const displays = [main, right]

describe('captureOutline — where the "this is what I took" flash is drawn', () => {
  it('outlines a region exactly as picked', () => {
    const rect = { x: 100, y: 200, width: 300, height: 150 }
    expect(captureOutline({ kind: 'region', ...rect }, { displays })).toEqual(rect)
  })

  it('outlines a window at its bounds', () => {
    const bounds = { x: 40, y: 60, width: 800, height: 600 }
    expect(captureOutline({ kind: 'window', windowId: 7 }, { displays, windowBounds: bounds })).toEqual(bounds)
  })

  it('outlines the main display for a whole-screen capture', () => {
    expect(captureOutline({ kind: 'screen' }, { displays })).toEqual(main)
  })

  it('keeps a window hanging off the edge inside its display, so the outline is visible', () => {
    const bounds = { x: -50, y: 900, width: 400, height: 300 }
    expect(captureOutline({ kind: 'window', windowId: 7 }, { displays, windowBounds: bounds }))
      .toEqual({ x: 0, y: 900, width: 350, height: 82 })
  })

  it('clips a window straddling two displays to the one holding most of it', () => {
    const bounds = { x: 1400, y: 100, width: 600, height: 400 }
    expect(captureOutline({ kind: 'window', windowId: 7 }, { displays, windowBounds: bounds }))
      .toEqual({ x: 1512, y: 100, width: 488, height: 400 })
  })

  it('draws nothing when the window position is unknown, rather than a wrong box', () => {
    expect(captureOutline({ kind: 'window', windowId: 7 }, { displays })).toBeNull()
  })

  it('draws nothing for a window entirely off every display', () => {
    const bounds = { x: -3000, y: 0, width: 400, height: 300 }
    expect(captureOutline({ kind: 'window', windowId: 7 }, { displays, windowBounds: bounds })).toBeNull()
  })
})
