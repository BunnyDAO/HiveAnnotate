import { useCallback, useEffect, useState } from 'react'
import { GRID_KEYS, RegionSelection } from '@hiveannotate/core/regionSelection'
import type { Rect } from '@hiveannotate/core/regionSelection'

const honey = '#E8A33D'
/** Light enough to read what is outside the selection, dark enough to separate it. */
const SCRIM = 'rgba(9,7,4,.42)'
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
        // Descend: the box you have built becomes the new grid, so the next
        // letters subdivide it. This is what keeps deep precision reachable.
        e.preventDefault()
        setSelection(selection.descend())
        return
      }
      if (e.shiftKey && key.startsWith('Arrow')) {
        e.preventDefault()
        const direction = key.replace('Arrow', '').toLowerCase() as 'left' | 'right' | 'up' | 'down'
        setSelection(selection.nudge(direction))
        return
      }

      // Letters mark cells; the selection is the bounding box of everything
      // marked, so the first press anchors and later presses extend.
      const next = selection.toggle(key)
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
    <div style={{ position: 'fixed', inset: 0, cursor: 'none' }}>
      {/* A spotlight: four dim panels around the selection, so the selection
          itself is a clear hole showing the real screen at full brightness.
          You are framing a screenshot — what is inside the frame must be
          readable, not washed out. */}
      {(() => {
        const r = local(rect)
        const W = bounds.width
        const H = bounds.height
        const dimStyle = { position: 'absolute' as const, background: SCRIM }
        return (
          <>
            <div style={{ ...dimStyle, left: 0, top: 0, width: W, height: r.top }} />
            <div style={{ ...dimStyle, left: 0, top: r.top + r.height, width: W, height: H - r.top - r.height }} />
            <div style={{ ...dimStyle, left: 0, top: r.top, width: r.left, height: r.height }} />
            <div style={{ ...dimStyle, left: r.left + r.width, top: r.top, width: W - r.left - r.width, height: r.height }} />
          </>
        )
      })()}

      <div
        style={{
          position: 'absolute',
          ...local(rect),
          border: `2px solid ${honey}`,
          boxShadow: '0 0 0 1px rgba(0,0,0,.45)',
          pointerEvents: 'none',
        }}
      />

      {cells.map((cell, i) => (
        <div
          key={GRID_KEYS[i]}
          style={{
            position: 'absolute',
            ...local(cell),
            // Lines and letters only — no fills. Anything painted inside the
            // spotlight would stand between you and what you are framing.
            border: selection.isMarked(i)
              ? `2px solid rgba(232,163,61,.9)`
              : '1px dashed rgba(232,163,61,.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: Math.max(12, Math.min(48, cell.height / 4)),
            color: selection.isMarked(i) ? honey : 'rgba(232,163,61,.7)',
            textShadow: '0 1px 3px rgba(0,0,0,.9), 0 0 1px rgba(0,0,0,.9)',
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Enter</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>capture</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Q W E …</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>select a square · press again to unselect</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Delete</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>undo</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Space</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>zoom in</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Shift + arrows</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>nudge edge</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Esc</Key><span style={{ fontSize: 12, color: '#A89F8D' }}>cancel</span></span>
      </div>
    </div>
  )
}
