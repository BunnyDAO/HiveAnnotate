import { theme, fonts, accentAlpha } from './theme.ts'
import { useEffect, useRef, useState } from 'react'

import type { FailurePayload, PendingView } from './bridge.ts'
import { filingChoices } from '@hiveannotate/core/filingChoices'
import type { FilingTarget } from '@hiveannotate/core/filingChoices'

const ground = theme.surface
const border = theme.borderStrong
const accent = theme.accent
const ink = theme.text
const muted = theme.muted
const dim = theme.dim
/** A selected filing chip: a quiet tint of the accent rather than a solid fill. */
const CHIP_ON_BG = accentAlpha(0.12)
const mono = fonts.mono

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
        background: theme.border,
        border: `1px solid ${border}`,
        fontFamily: mono,
        fontSize: 11,
        color: theme.textBody,
      }}
    >
      {children}
    </span>
  )
}

export function CaptureBar(): React.JSX.Element {
  const [view, setView] = useState<PendingView | null>(null)
  const [note, setNote] = useState('')
  /** Index into `choices` of the chip that Enter will file into. */
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<FailurePayload | null>(null)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.hive?.onPending?.((incoming) => {
      setView(incoming)
      setFailure(null)
      setError(null)
      // A retry keeps the note: a failed capture costs the image, never the
      // sentence the user had already typed.
      if (!incoming.isRetry) {
        setNote('')
        setSelected(0)
      }
      // Focused without a click: the whole premise is that you type immediately.
      requestAnimationFrame(() => field.current?.focus())
    })

    window.hive?.onFailed?.((payload) => {
      // The note is deliberately untouched here — rule two.
      setFailure(payload)
      setError(null)
      requestAnimationFrame(() => field.current?.focus())
    })
  }, [])

  // Every option is a visible chip: the default first, a new bundle right
  // beside it, then the other open bundles.
  const choices = view
    ? filingChoices(view.destination as Parameters<typeof filingChoices>[0], view.bundles)
    : filingChoices({ kind: 'new' }, [])
  const current = choices[Math.min(selected, choices.length - 1)] ?? choices[0]!

  function pick(index: number): void {
    setSelected(index)
    // Clicking a chip must not strand the user outside the note field.
    requestAnimationFrame(() => field.current?.focus())
  }

  async function commit(copyPointer: boolean, target: FilingTarget): Promise<void> {
    try {
      await window.hive?.commit?.({ note, target, copyPointer })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault()
      // Even a blocking failure can be dismissed deliberately — it just never
      // closes on its own.
      void window.hive?.discard?.()
      return
    }
    if (failure) {
      if (e.key === 'Enter') {
        e.preventDefault()
        void window.hive?.retry?.()
      }
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const step = e.shiftKey ? -1 : 1
      setSelected((i) => (i + step + choices.length) % choices.length)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Shift + Enter stays a shortcut for "new bundle", whatever is selected.
      void commit(e.metaKey, e.shiftKey ? { kind: 'new' } : current.target)
    }
  }

  const staleNotice = view?.destination.kind === 'new' && view.destination.reason === 'stale'

  return (
    <div
      style={{
        boxSizing: 'border-box',
        // Sized to its content, not the window: the window is tall enough for
        // the failure state, and a full-height panel left a band of dead space
        // under the hints in the normal one. What is below is transparent.
        padding: '18px 20px',
        borderRadius: 14,
        background: ground,
        border: `1px solid ${border}`,
        boxShadow: '0 28px 70px rgba(0,0,0,.7)',
        fontFamily: fonts.sans,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: failure ? theme.danger : accent }} />
          <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: '.09em', color: failure ? theme.danger : accent }}>
            {failure ? failure.explanation.title.toUpperCase() : 'CAPTURED'}
          </span>
        </span>
        {view && !failure && (
          <span style={{ fontFamily: mono, fontSize: 11, color: dim }}>
            {`${view.kind}${view.app ? ` · ${view.app}` : ''} · ${view.width}×${view.height}`}
          </span>
        )}
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

      {!failure && (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: dim }}>filing into</span>
        {choices.map((choice, index) => {
          const on = index === selected
          return (
            <button
              key={choice.key}
              type="button"
              aria-pressed={on}
              onClick={() => pick(index)}
              title={choice.isNew ? 'Named from your note' : choice.label}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                padding: '5px 11px',
                borderRadius: 999,
                maxWidth: 220,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: on ? CHIP_ON_BG : 'transparent',
                border: `1px ${choice.isNew && !on ? 'dashed' : 'solid'} ${on ? accent : border}`,
              }}
            >
              {on && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accent, flexShrink: 0 }} />}
              <span
                style={{
                  fontSize: 12,
                  fontWeight: on ? 600 : 400,
                  color: on ? accent : muted,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {choice.isNew ? '+ New bundle' : choice.label}
              </span>
            </button>
          )
        })}
        {staleNotice && (
          <span style={{ fontSize: 12, color: muted }}>
            — the last bundle went quiet, so this starts a new one
          </span>
        )}
      </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: theme.danger, paddingBottom: 12 }}>{error}</div>
      )}

      {failure && (
        <div style={{ paddingBottom: 12 }}>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: theme.textBody, marginBottom: 10 }}>
            {failure.explanation.detail}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            {failure.explanation.settingsPane && (
              <button
                type="button"
                onClick={() => void window.hive?.openSettings?.(failure.explanation.settingsPane!)}
                style={{
                  padding: '7px 13px',
                  borderRadius: 7,
                  background: theme.danger,
                  border: `1px solid ${theme.danger}`,
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme.onDanger,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Open System Settings
              </button>
            )}
            {failure.explanation.alternative && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Key>Option + 2</Key>
                <button
                  type="button"
                  onClick={() => void window.hive?.wholeScreen?.()}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 12, color: muted, cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {failure.explanation.alternative}
                </button>
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Key>Enter</Key>
              <span style={{ fontSize: 12, color: muted }}>{failure.explanation.retryLabel}</span>
            </span>
          </div>
        </div>
      )}

      {/* In the failure state Enter means retry, so the normal hints — where
          Enter means save — would show two meanings for one key at once. */}
      {failure ? (
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 13, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Esc</Key><span style={{ fontSize: 12, color: muted }}>throw away</span></span>
        </div>
      ) : (
        <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 13, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Enter</Key><span style={{ fontSize: 12, color: muted }}>save</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Shift + Enter</Key><span style={{ fontSize: 12, color: muted }}>save as a new bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Tab</Key><span style={{ fontSize: 12, color: muted }}>choose bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Cmd + Enter</Key><span style={{ fontSize: 12, color: muted }}>save + copy link</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Esc</Key><span style={{ fontSize: 12, color: muted }}>throw away</span></span>
        </div>
      )}
    </div>
  )
}
