import { useCallback, useEffect, useState } from 'react'
import type { BundleSummary, BundleView } from './bridge.ts'

const ground = '#14120E'
const panel = '#191610'
const line = '#2A261F'
const honey = '#E8A33D'
const ink = '#F5F1E8'
const muted = '#A89F8D'
const dim = '#6E6558'
const mono = "'IBM Plex Mono', ui-monospace, monospace"
const sans = "'IBM Plex Sans', system-ui, sans-serif"
const display = "'Space Grotesk', system-ui, sans-serif"

function toneFor(status: string): string {
  return status === 'closed' ? '#8A8172' : honey
}

function ago(iso: string): string {
  if (!iso) return ''
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return `${Math.round(hours / 24)} d ago`
}

export function Catalogue(): React.JSX.Element {
  const [bundles, setBundles] = useState<BundleSummary[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [bundle, setBundle] = useState<BundleView | null>(null)
  const [adapters, setAdapters] = useState<{ id: string; label: string }[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  /** Index into bundle.captures of the screenshot open full size, if any. */
  const [viewing, setViewing] = useState<number | null>(null)

  const refresh = useCallback(async (keep?: string) => {
    const list = (await window.hive?.catalogue?.list()) ?? []
    setBundles(list)
    const next = keep ?? selected ?? list[0]?.id ?? null
    setSelected(next)
    setBundle(next ? ((await window.hive?.catalogue?.get(next)) ?? null) : null)
  }, [selected])

  useEffect(() => {
    void refresh()
    void window.hive?.catalogue?.adapters().then((a) => setAdapters(a ?? []))
    // Refresh on focus so a bundle closed by an agent, or a capture taken while
    // this window was open, shows up without a restart.
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    window.hive?.catalogue?.onRefresh?.(() => void refresh())
    return () => window.removeEventListener('focus', onFocus)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function select(id: string): Promise<void> {
    setViewing(null)
    setSelected(id)
    setBundle((await window.hive?.catalogue?.get(id)) ?? null)
  }

  useEffect(() => {
    if (viewing === null || !bundle) return
    const count = bundle.captures.length
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setViewing(null)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        setViewing((i) => (i === null ? i : (i + 1) % count))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setViewing((i) => (i === null ? i : (i - 1 + count) % count))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, bundle])

  async function act(label: string, fn: () => Promise<unknown>): Promise<void> {
    setBusy(label)
    try {
      await fn()
      await refresh(selected ?? undefined)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: ground, color: ink, fontFamily: sans }}>
      <aside style={{ width: 312, flexShrink: 0, borderRight: `1px solid ${line}`, background: panel, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '38px 16px 12px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: display, fontWeight: 700, fontSize: 16 }}>Bundles</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: dim }}>
            {bundles.filter((b) => b.status === 'open').length} open
          </span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {bundles.length === 0 && (
            <p style={{ padding: '8px 12px', fontSize: 12, lineHeight: 1.6, color: dim }}>
              Nothing captured yet. Press Option + 1 to pick part of the screen.
            </p>
          )}
          {bundles.map((b) => {
            const on = b.id === selected
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => void select(b.id)}
                style={{
                  display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'left',
                  padding: 12, borderRadius: 8, cursor: 'pointer', fontFamily: sans,
                  background: on ? '#241F17' : 'transparent',
                  border: `1px solid ${on ? '#453C2C' : 'transparent'}`,
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: b.damaged ? '#D9634F' : toneFor(b.status) }} />
                  <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.08em', color: b.damaged ? '#D9634F' : toneFor(b.status) }}>
                    {b.damaged ? 'DAMAGED' : b.status.toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: mono, fontSize: 10, color: dim }}>{ago(b.createdAt)}</span>
                </span>
                <span style={{ display: 'block', fontSize: 13, lineHeight: 1.45, fontWeight: on ? 600 : 400, color: on ? ink : muted }}>
                  {b.intent}
                </span>
                <span style={{ display: 'block', marginTop: 6, fontFamily: mono, fontSize: 10, color: dim }}>
                  {b.captureCount} {b.captureCount === 1 ? 'capture' : 'captures'}
                </span>
              </button>
            )
          })}
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, padding: '38px 30px 30px', overflowY: 'auto' }}>
        {!bundle && <p style={{ color: dim, fontSize: 13 }}>Select a bundle.</p>}
        {bundle && (
          <>
            <div style={{ fontFamily: mono, fontSize: 11, color: dim, marginBottom: 10 }}>{bundle.id}</div>

            <label htmlFor="intent" style={{ display: 'block', fontFamily: mono, fontSize: 10, letterSpacing: '.1em', color: honey, marginBottom: 8 }}>
              WHAT I WANT DONE
            </label>
            <textarea
              id="intent"
              defaultValue={bundle.intent}
              key={`${bundle.id}-intent`}
              onBlur={(e) => void act('intent', () => window.hive!.catalogue!.editIntent(bundle.id, e.target.value))}
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 72, resize: 'vertical',
                background: '#1B1812', border: `1px solid #2F2A22`, borderLeft: `2px solid ${honey}`,
                borderRadius: 9, padding: '14px 16px', color: '#D8D0BE', fontSize: 14,
                lineHeight: 1.6, fontFamily: sans, outline: 'none', marginBottom: 22,
              }}
            />

            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.1em', color: dim, marginBottom: 10 }}>
              {bundle.captures.length} CAPTURES IN THIS BUNDLE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {bundle.captures.map((c) => (
                <div key={c.index} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: '#1A1711', border: `1px solid ${line}`, borderRadius: 9, padding: 12 }}>
                  <button
                    type="button"
                    title="Double-click to view full size"
                    aria-label={`View ${c.file} full size`}
                    onDoubleClick={() => setViewing(bundle.captures.indexOf(c))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setViewing(bundle.captures.indexOf(c))
                      }
                    }}
                    style={{ padding: 0, border: 'none', background: 'none', cursor: 'zoom-in', flexShrink: 0, borderRadius: 6 }}
                  >
                    <img
                      src={c.src}
                      alt={c.note || `capture ${c.file}`}
                      style={{ display: 'block', width: 176, height: 112, objectFit: 'cover', objectPosition: 'top left', borderRadius: 6, background: '#221E18', border: '1px solid #2F2A22' }}
                    />
                  </button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 7 }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: honey }}>{c.file}</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: dim }}>
                        {c.kind}{c.app ? ` · ${c.app}` : ''} · {c.width}×{c.height}
                      </span>
                    </div>
                    <textarea
                      defaultValue={c.note}
                      key={`${bundle.id}-${c.index}-note`}
                      aria-label={`Note for ${c.file}`}
                      onBlur={(e) => void act('note', () => window.hive!.catalogue!.editNote(bundle.id, c.index, e.target.value))}
                      style={{ width: '100%', boxSizing: 'border-box', minHeight: 48, resize: 'vertical', background: 'transparent', border: 'none', outline: 'none', color: '#D8D0BE', fontSize: 13, lineHeight: 1.55, fontFamily: sans }}
                    />
                    <div style={{ display: 'flex', gap: 14, marginTop: 6 }}>
                      <select
                        aria-label={`Move ${c.file} to another bundle`}
                        value=""
                        onChange={(e) => {
                          const to = e.target.value
                          if (!to) return
                          void act('move', () => window.hive!.catalogue!.moveCapture(bundle.id, c.index, to === '__new__' ? null : to))
                        }}
                        style={{ background: '#221E18', color: muted, border: `1px solid #332E25`, borderRadius: 6, fontSize: 11, padding: '4px 8px', fontFamily: sans }}
                      >
                        <option value="">Move to…</option>
                        <option value="__new__">A new bundle</option>
                        {bundles.filter((b) => b.id !== bundle.id && !b.damaged).map((b) => (
                          <option key={b.id} value={b.id}>{b.intent.slice(0, 48)}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => void act('delete', () => window.hive!.catalogue!.deleteCapture(bundle.id, c.index))}
                        style={{ background: 'none', border: 'none', color: '#8A6F62', fontSize: 11, cursor: 'pointer', fontFamily: sans, padding: 0 }}
                      >
                        Delete capture
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {viewing !== null && bundle && bundle.captures[viewing] && (() => {
        const c = bundle.captures[viewing]!
        return (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${c.file} full size`}
            onClick={() => setViewing(null)}
            style={{
              position: 'fixed', inset: 0, zIndex: 10, background: 'rgba(6,5,3,.92)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 14, padding: '44px 32px 24px', boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              aria-label="Close"
              onClick={() => setViewing(null)}
              style={{ position: 'absolute', top: 38, right: 24, width: 34, height: 34, borderRadius: 8, border: `1px solid #3A342B`, background: '#1E1B16', color: ink, fontSize: 16, cursor: 'pointer' }}
            >
              ✕
            </button>
            <img
              src={c.src}
              alt={c.note || c.file}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: 'calc(100vh - 170px)', objectFit: 'contain', borderRadius: 6, boxShadow: '0 20px 60px rgba(0,0,0,.6)', cursor: 'default' }}
            />
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: dim, marginBottom: 6 }}>
                {viewing + 1} / {bundle.captures.length} · {c.file} · {c.kind}{c.app ? ` · ${c.app}` : ''} · {c.width}×{c.height}
              </div>
              {c.note && <div style={{ fontSize: 14, lineHeight: 1.55, color: '#D8D0BE' }}>{c.note}</div>}
              <div style={{ fontFamily: mono, fontSize: 10, color: dim, marginTop: 8 }}>Left / Right arrow keys to step through · Esc to close</div>
            </div>
          </div>
        )
      })()}

      <aside style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${line}`, background: panel, padding: '38px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: display, fontWeight: 700, fontSize: 15, marginBottom: 2 }}>Hand off</div>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: dim }}>
          The core does not know what any of these are. Each one is an adapter.
        </p>

        {adapters.map((a) => (
          <button
            key={a.id}
            type="button"
            disabled={!bundle || busy !== null}
            onClick={() => void act('handoff', () => window.hive!.catalogue!.handoff(bundle!.id, a.id))}
            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '12px 14px', borderRadius: 8, background: '#221E18', border: `1px solid #332E25`, color: ink, fontSize: 13, fontWeight: 600, cursor: bundle ? 'pointer' : 'default', fontFamily: sans }}
          >
            {a.label}
          </button>
        ))}

        {bundle && bundle.status === 'open' && (
          <button
            type="button"
            onClick={() => void act('close', () => window.hive!.catalogue!.closeBundle(bundle.id))}
            style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', padding: '12px 14px', borderRadius: 8, background: 'transparent', border: `1px dashed #332E25`, color: muted, fontSize: 13, cursor: 'pointer', fontFamily: sans }}
          >
            Mark handled
          </button>
        )}

        {bundle && (
          <div style={{ borderTop: `1px solid ${line}`, paddingTop: 16, marginTop: 6, fontFamily: mono, fontSize: 11, color: dim, lineHeight: 1.7, wordBreak: 'break-all' }}>
            {bundle.pointer}
          </div>
        )}
      </aside>
    </div>
  )
}
