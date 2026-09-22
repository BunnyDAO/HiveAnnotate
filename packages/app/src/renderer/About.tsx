import './bridge.ts'
import { theme, fonts } from './theme.ts'
import mark from './assets/mark.png'

/**
 * HiveAnnotate is free, and made by HiveOp. The branding says "made by", not
 * "buy": a utility that advertises at you gets uninstalled. The one promise
 * that matters most to someone letting an app see their screen is stated
 * plainly, because it is true — nothing leaves the Mac.
 */
export function About(): React.JSX.Element {
  const info = window.hive

  return (
    <main
      style={{
        margin: 0,
        height: '100vh',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 10,
        padding: '28px 32px',
        fontFamily: fonts.sans,
        background: theme.background,
        color: theme.text,
      }}
    >
      <img src={mark} alt="" width={72} height={72} />
      <h1 style={{ margin: '6px 0 0', fontSize: 22, fontWeight: 700, letterSpacing: '-.01em' }}>
        {info?.appName ?? 'HiveAnnotate'}
      </h1>
      <a
        href="https://hiveop.io"
        target="_blank"
        rel="noreferrer"
        style={{ fontSize: 13, color: theme.accent, textDecoration: 'none' }}
      >
        by HiveOp
      </a>
      <p style={{ margin: '8px 0 0', fontSize: 13, lineHeight: 1.55, color: theme.textBody, maxWidth: 320 }}>
        Keyboard screenshots with notes, ready to hand to any AI agent.
      </p>
      <p style={{ margin: 0, fontSize: 12, color: theme.muted }}>
        Your screenshots never leave your Mac.
      </p>
      <p style={{ margin: '10px 0 0', fontFamily: fonts.mono, fontSize: 10, color: theme.dim }}>
        {info?.bundleId ?? ''}
      </p>
    </main>
  )
}
