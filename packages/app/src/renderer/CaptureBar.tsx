import { useEffect, useRef, useState } from 'react'

import type { PendingView } from './bridge.ts'

const ground = '#1E1B16'
const border = '#3A342B'
const honey = '#E8A33D'
const ink = '#F5F1E8'
const muted = '#A89F8D'
const dim = '#6E6558'
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
        border: `1px solid ${border}`,
        fontFamily: mono,
        fontSize: 11,
        color: '#D8D0BE',
      }}
    >
      {children}
    </span>
  )
}

export function CaptureBar(): React.JSX.Element {
  const [view, setView] = useState<PendingView | null>(null)
  const [note, setNote] = useState('')
  const [targetIndex, setTargetIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.hive?.onPending?.((incoming) => {
      setView(incoming)
      // The note is deliberately not cleared on a retry — see hive-v1-13. It is
      // cleared here because this is a brand new capture.
      setNote('')
      setTargetIndex(0)
      setError(null)
      // Focused without a click: the whole premise is that you type immediately.
      requestAnimationFrame(() => field.current?.focus())
    })
  }, [])

  // [default] + every open bundle, cycled with ⇥.
  const choices = view
    ? [
        view.destination.kind === 'append'
          ? {
              label: view.bundles.find((b) => b.id === view.destination.bundleId)?.intent ?? 'active bundle',
              index: 0,
            }
          : { label: 'a new bundle', index: 0 },
        ...view.bundles.map((b, i) => ({ label: b.intent, index: i + 1 })),
      ]
    : [{ label: 'a new bundle', index: 0 }]

  const current = choices[Math.min(targetIndex, choices.length - 1)] ?? choices[0]!

  async function commit(copyPointer: boolean, forceNew: boolean): Promise<void> {
    try {
      await window.hive?.commit?.({
        note,
        targetIndex: forceNew ? -1 : targetIndex,
        copyPointer,
      })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      void window.hive?.discard?.()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      setTargetIndex((i) => (i + 1) % choices.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      void commit(e.metaKey, e.shiftKey)
    }
  }

  const staleNotice = view?.destination.kind === 'new' && view.destination.reason === 'stale'

  return (
    <div
      style={{
        boxSizing: 'border-box',
        height: '100vh',
        padding: '18px 20px',
        borderRadius: 14,
        background: ground,
        border: `1px solid ${border}`,
        boxShadow: '0 28px 70px rgba(0,0,0,.7)',
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: honey }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.09em', color: honey }}>CAPTURED</span>
        </span>
        <span style={{ fontFamily: mono, fontSize: 11, color: dim }}>
          {view ? `${view.kind}${view.app ? ` · ${view.app}` : ''} · ${view.width}×${view.height}` : '…'}
        </span>
      </div>

      <label htmlFor="note" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        What should the agent do about this?
      </label>
      <input
        id="note"
        ref={field}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="what's wrong / what should happen?"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          fontSize: 18,
          color: ink,
          padding: '0 0 14px 0',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: dim }}>filing into</span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 11px',
            borderRadius: 999,
            background: '#2A261F',
            border: `1px solid ${border}`,
            maxWidth: 380,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: honey }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: honey, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current.label}
          </span>
        </span>
        {staleNotice && (
          <span style={{ fontSize: 12, color: muted }}>
            — the last bundle went quiet, so this starts a new one
          </span>
        )}
      </div>

      {error && (
        <div style={{ fontSize: 12, color: '#D9634F', paddingBottom: 12 }}>{error}</div>
      )}

      <div style={{ borderTop: `1px solid #2A261F`, paddingTop: 13, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⏎</Key><span style={{ fontSize: 12, color: muted }}>file it</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⇧⏎</Key><span style={{ fontSize: 12, color: muted }}>file + new bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⇥</Key><span style={{ fontSize: 12, color: muted }}>switch bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⌘⏎</Key><span style={{ fontSize: 12, color: muted }}>file + copy</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>⎋</Key><span style={{ fontSize: 12, color: muted }}>discard</span></span>
      </div>
    </div>
  )
}
