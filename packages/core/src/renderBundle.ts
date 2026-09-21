import type { Bundle } from './bundleStore.ts'

/** Renders a Bundle as the markdown an agent or a human reads. */
export function renderBundleMarkdown(bundle: Bundle): string {
  const lines: string[] = [
    `# ${bundle.intent}`,
    '',
    // Explains the file to an agent that has never heard of HiveAnnotate — the
    // same reason the copied pointer describes itself.
    '> A HiveAnnotate bundle: screenshots plus notes on what needs doing. The heading above ' +
      'is what the user wants done. Each section below is a screenshot in this folder, with ' +
      "the user's note about it.",
    '',
  ]

  for (const capture of bundle.captures) {
    const where = capture.app ? `${capture.kind} · ${capture.app}` : capture.kind
    lines.push(`## ${capture.file} — ${where} · ${capture.width}×${capture.height}`)
    lines.push(capture.note)
    lines.push('')
  }

  return lines.join('\n')
}
