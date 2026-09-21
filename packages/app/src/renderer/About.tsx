import './bridge.ts'

export function About(): React.JSX.Element {
  const info = window.hive

  return (
    <main
      style={{
        margin: 0,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 8,
        padding: '0 28px',
        fontFamily: 'system-ui, sans-serif',
        background: '#14120E',
        color: '#F5F1E8',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20 }}>{info?.appName ?? 'HiveAnnotate'}</h1>
      <p style={{ margin: 0, fontSize: 12, color: '#A89F8D' }}>{info?.bundleId ?? 'bundle id unavailable'}</p>
    </main>
  )
}
