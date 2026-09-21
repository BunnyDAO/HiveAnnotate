import type { Bundle } from './bundleStore.ts'

/** Renders a Bundle as the markdown an agent or a human reads. */
export function renderBundleMarkdown(bundle: Bundle): string {
  const lines: string[] = [`# ${bundle.intent}`, '']

  for (const capture of bundle.captures) {
    const where = capture.app ? `${capture.kind} · ${capture.app}` : capture.kind
    lines.push(`## ${capture.file} — ${where} · ${capture.width}×${capture.height}`)
    lines.push(capture.note)
    lines.push('')
  }

  return lines.join('\n')
}
