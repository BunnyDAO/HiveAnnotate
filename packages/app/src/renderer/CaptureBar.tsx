import { theme, fonts, accentAlpha } from './theme.ts'
import { useEffect, useRef, useState } from 'react'

import type { FailurePayload, PendingView } from './bridge.ts'
import { filingChoices } from '@hiveannotate/core/filingChoices'
import { isMac, primaryModifierName } from '@hiveannotate/core/formatAccelerator'
import type { FilingTarget } from '@hiveannotate/core/filingChoices'

const ground = theme.surface
const border = theme.borderStrong
const accent = theme.accent
const ink = theme.text
const muted = theme.muted
const dim = theme.dim
/** A selected filing chip: a quiet tint of the accent rather than a solid fill. */
const CHIP_ON_BG = accentAlpha(0.12)
/** Cmd on a Mac, Ctrl on Windows and Linux — for the keys and for the hints. */
const PLATFORM = window.hive?.platform ?? 'darwin'
const MOD = primaryModifierName(PLATFORM)
const modHeld = (e: { metaKey: boolean; ctrlKey: boolean }) => (isMac(PLATFORM) ? e.metaKey : e.ctrlKey)
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
  /** The new bundle's name. Typed by the user — never copied from the note. */
  const [bundleName, setBundleName] = useState('')
  const nameField = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  /** The capture shown large, so it can be checked before Enter commits it. */
  const [previewing, setPreviewing] = useState(false)
  const [failure, setFailure] = useState<FailurePayload | null>(null)
  /** Copy and go has run: shown for a moment before the bar closes. */
  const [copied, setCopied] = useState(false)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.hive?.onPending?.((incoming) => {
      setView(incoming)
      setPreviewing(false)
      setFailure(null)
      setError(null)
      // A retry keeps the note: a failed capture costs the image, never the
      // sentence the user had already typed.
      if (!incoming.isRetry) {
        setNote('')
        setSelected(0)
        setBundleName('')
      }
      // Focused without a click: the whole premise is that you type immediately.
      requestAnimationFrame(() => field.current?.focus())
    })

    window.hive?.onFailed?.((payload) => {
      // A retry keeps the note — rule two: a failed capture costs the image,
      // never the thought. But a *new* capture that fails at once must start
      // blank, or it inherits the previous capture's note (it did: the bar
      // window is reused between captures).
      if (!payload.isRetry) {
        setNote('')
        setSelected(0)
        setBundleName('')
      }
      setPreviewing(false)
      setFailure(payload)
      setError(null)
      requestAnimationFrame(() => field.current?.focus())
    })
  }, [])

  // Every option is a visible chip: the default first, the other open
  // bundles, then "+ New bundle".
  const choices = view
    ? filingChoices(view.destination as Parameters<typeof filingChoices>[0], view.bundles)
    : filingChoices({ kind: 'new' }, [])
  const current = choices[Math.min(selected, choices.length - 1)] ?? choices[0]!

  // A new bundle needs a name the user types. It used to be prefilled from
  // the note and mirrored it while typing; the user found that wrong — the
  // note says what is broken, the name says which bucket it goes in.
  // Required: a new bundle cannot be saved without one.
  const naming = current.isNew
  const nameValue = bundleName

  /** Selects a chip and puts the cursor where the next keystroke belongs. */
  function select(index: number): void {
    setSelected(index)
    setError(null)
    const chosen = choices[index]
    requestAnimationFrame(() => {
      // Choosing "+ New bundle" means you are about to name it; otherwise
      // the note field is where typing goes.
      if (chosen?.isNew && !chosen.isDefault) {
        nameField.current?.focus()
      } else {
        field.current?.focus()
      }
    })
  }

  async function commit(copyPointer: boolean, target: FilingTarget): Promise<void> {
    let finalTarget = target
    if (target.kind === 'new') {
      const name = nameValue.trim()
      if (!name) {
        setError('Name the new bundle first.')
        requestAnimationFrame(() => nameField.current?.focus())
        return
      }
      finalTarget = { kind: 'new', name }
    }
    try {
      await window.hive?.commit?.({ note, target: finalTarget, copyPointer })
    } catch (e) {
      setError((e as Error).message)
    }
  }

  /**
   * Copy and go: the note plus a path to the screenshot land on the clipboard,
   * ready to paste into an agent's terminal, and nothing is filed. Confirmed
   * on screen for a moment first, or the bar would vanish with no sign of
   * whether anything was copied.
   */
  async function copyAndGo(): Promise<void> {
    if (!view || copied) return
    try {
      const result = await window.hive?.copyAndGo?.(note)
      if (!result) return
      setCopied(true)
      window.setTimeout(() => void window.hive?.discard?.(), 1100)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function togglePreview(): void {
    if (!view?.imageDataUrl) return
    const next = !previewing
    setPreviewing(next)
    void window.hive?.preview?.(next)
    // Keep the cursor in the note: look and type at the same time.
    requestAnimationFrame(() => field.current?.focus())
  }

  // Cmd/Ctrl + P and Esc-while-previewing must work wherever focus is in the
  // bar — after clicking the thumbnail, say — not only inside the note. The
  // note's own handler runs first and marks what it handled, so nothing fires
  // twice.
  useEffect(() => {
    const onWindowKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return
      if (modHeld(e) && e.key.toLowerCase() === 'p') {
        e.preventDefault()
        togglePreview()
      } else if (e.key === 'Escape' && previewing) {
        e.preventDefault()
        togglePreview()
      }
    }
    window.addEventListener('keydown', onWindowKey)
    return () => window.removeEventListener('keydown', onWindowKey)
  })

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (modHeld(e) && e.key.toLowerCase() === 'p') {
      e.preventDefault()
      togglePreview()
      return
    }
    // While previewing, Esc closes the preview. It must never be the key that
    // throws the capture away just because the user was looking at it.
    if (e.key === 'Escape' && previewing) {
      e.preventDefault()
      togglePreview()
      return
    }
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
      select((selected + step + choices.length) % choices.length)
      return
    }
    if (e.key === 'Enter' && modHeld(e) && e.shiftKey) {
      e.preventDefault()
      void copyAndGo()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      // Shift + Enter stays a shortcut for "new bundle", whatever is selected.
      void commit(modHeld(e), e.shiftKey ? { kind: 'new' } : current.target)
    }
  }

  const staleNotice = view?.destination.kind === 'new' && view.destination.reason === 'stale'

  const panel = (
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
        // Soft enough to sit calmly over a white app as well as a dark one;
        // the heavier shadow read as a grey smudge over light windows.
        boxShadow: '0 12px 32px rgba(0,0,0,.35)',
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
          <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: dim }}>
              {`${view.kind}${view.app ? ` · ${view.app}` : ''} · ${view.width}×${view.height}`}
            </span>
            {view.imageDataUrl && !previewing && (
              <button
                type="button"
                onClick={togglePreview}
                title={`Preview (${MOD} + P)`}
                aria-label={`Preview the capture (${MOD} + P)`}
                style={{ padding: 0, border: `1px solid ${theme.borderStrong}`, borderRadius: 5, background: theme.surfaceRaised, cursor: 'zoom-in', lineHeight: 0 }}
              >
                <img src={view.imageDataUrl} alt="" style={{ width: 72, height: 44, objectFit: 'cover', objectPosition: 'top left', borderRadius: 4 }} />
              </button>
            )}
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
              onClick={() => select(index)}
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

      {!failure && naming && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 14 }}>
          <label htmlFor="bundle-name" style={{ fontSize: 12, color: dim, whiteSpace: 'nowrap' }}>
            Bundle name
          </label>
          <input
            id="bundle-name"
            ref={nameField}
            required
            value={nameValue}
            onChange={(e) => {
              setBundleName(e.target.value)
              setError(null)
            }}
            onKeyDown={onKeyDown}
            placeholder="name this bundle"
            aria-describedby="bundle-name-hint"
            style={{
              flex: 1,
              minWidth: 0,
              boxSizing: 'border-box',
              padding: '6px 10px',
              borderRadius: 7,
              background: theme.surfaceRaised,
              border: `1px solid ${error ? theme.danger : theme.borderStrong}`,
              outline: 'none',
              fontSize: 13,
              color: ink,
              fontFamily: 'inherit',
            }}
          />
          <span id="bundle-name-hint" style={{ fontSize: 11, color: dim, whiteSpace: 'nowrap' }}>
            required
          </span>
        </div>
      )}

      {copied && (
        <div style={{ fontSize: 13, color: theme.accent, paddingBottom: 12 }}>
          Copied. Paste it into your agent — nothing was saved.
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
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Shift + Enter</Key><span style={{ fontSize: 12, color: muted }}>new bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Tab</Key><span style={{ fontSize: 12, color: muted }}>choose bundle</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>{`${MOD} + Enter`}</Key><span style={{ fontSize: 12, color: muted }}>save + copy prompt</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>{`${MOD} + Shift + Enter`}</Key><span style={{ fontSize: 12, color: muted }}>copy only, do not save</span></span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>{`${MOD} + P`}</Key><span style={{ fontSize: 12, color: muted }}>{previewing ? 'close preview' : 'preview'}</span></span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Key>Esc</Key><span style={{ fontSize: 12, color: muted }}>throw away</span></span>
        </div>
      )}
    </div>
  )

  if (!previewing || !view?.imageDataUrl) return panel

  return (
    <div style={{ height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: 14,
          background: theme.backdrop,
          border: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 12,
          boxSizing: 'border-box',
        }}
      >
        <img
          src={view.imageDataUrl}
          alt="The capture you are about to save"
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 }}
        />
      </div>
      {panel}
    </div>
  )
}
