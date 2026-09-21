import { useCallback, useEffect, useState } from 'react'
import { GRID_KEYS, RegionSelection } from '@hiveannotate/core/regionSelection'
import type { Rect } from '@hiveannotate/core/regionSelection'

const honey = '#E8A33D'
const mono = "'IBM Plex Mono', ui-monospace, monospace"

function Key({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 22,
        height: 22,
        padding: '0 6px',
        borderRadius: 5,
        background: '#2A261F',
        border: '1px solid #3A342B',
        fontFamily: mono,
        fontSize: 11,
        color: '#D8D0BE',
      }}
    >
      {children}
    </span>
  )
}

export function RegionPicker(): React.JSX.Element {
  const [bounds, setBounds] = useState<Rect | null>(null)
  const [selection, setSelection] = useState<RegionSelection | null>(null)

  useEffect(() => {
    window.hive?.onRegionBounds?.((incoming) => {
      setBounds(incoming)
      setSelection(new RegionSelection(incoming))
    })
  }, [])

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (!selection) return
      const key = e.key

      if (key === 'Escape') {
        e.preventDefault()
        void window.hive?.cancelRegion?.()
        return
      }
      if (key === 'Enter') {
        e.preventDefault()
        void window.hive?.pickRegion?.(selection.rect)
        return
      }
      if (key === 'Backspace') {
        e.preventDefault()
        setSelection(selection.back())
        return
      }
      if (key === ' ') {
        e.preventDefault()
        setSelection(selection.grow())
        return
      }
      if (e.shiftKey && key.startsWith('Arrow')) {
        e.preventDefault()
        const direction = key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down'
        setSelection(selection.nudge(direction))
        return
      }

      const next = selection.subdivide(key)
      if (next) {
        e.preventDefault()
        setSelection(next)
      }
    },
    [selection],
  )

  useEffect(() => {
    // The picker owns the whole screen while it is up, so a window-level
    // listener is right here — unlike the capture bar, which must not reach
    // beyond its own input.
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onKey])

  if (!bounds || !selection) return <div />

  const rect = selection.rect
  // Screen coordinates are global; the overlay window is placed at the display
  // origin, so drawing is relative to it.
  const local = (r: Rect) => ({
    left: r.x - bounds.x,
    top: r.y - bounds.y,
    width: r.width,
    height: r.height,
  })

  const cells = selection.cells()

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(9,7,4,.55)', cursor: 'none' }}>
      <div
        style={{
          position: 'absolute',
          ...local(rect),
          border: `2px solid ${honey}`,
          background: 'rgba(232,163,61,.06)',
          boxShadow: '0 0 40px rgba(232,163,61,.25)',
        }}
      />

      {cells.map((cell, i) => (
        <div
          key={GRID_KEYS[i]}
          style={{
            position: 'absolute',
            ...local(cell),
            border: '1px solid rgba(232,163,61,.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: Math.max(12, Math.min(48, cell.height / 4)),
            color: 'rgba(232,163,61,.55)',
            pointerEvents: 'none',
          }}
        >
          {GRID_KEYS[i]?.toUpperCase()}
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          left: '50%',
          transform: 'translateX(-50%)',
          bottom: 48,
          padding: '14px 18px',
          borderRadius: 12,
          background: '#1E1B16',
          border: '1px solid #3A342B',
          boxShadow: '0 24px 60px rgba(0,0,0,.7)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        }}
      >
        <span style={{ fontFamily: mono, fontSize: 11, color: honey }}>
          {rect.x}, {rect.y} · {rect.width} × {rect.height}
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⏎</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>capture</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⌫</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>back</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>␣</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>grow</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⇧←→</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>nudge</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⎋</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>cancel</span></span>
      </div>
    </div>
  )
}
