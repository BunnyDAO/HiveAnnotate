/**
 * The "filing into" choices shown under the note in the capture bar.
 *
 * Every option is visible as a chip — the default preselected, a way to start a
 * new bundle right there, and the other open bundles — rather than an invisible
 * list cycled with Tab. Asked for by the user after first use: "the default
 * 'filing into', but also the ability to create a new bundle right there".
 *
 * Zero imports on purpose, so the renderer can use it directly (core's barrel
 * pulls in node:fs, which a sandboxed renderer cannot load).
 */

export type FilingTarget =
  | { kind: 'active' }
  | { kind: 'new' }
  | { kind: 'bundle'; id: string }

export interface FilingChoice {
  key: string
  label: string
  target: FilingTarget
  /** Preselected: what Enter does without touching anything. */
  isDefault: boolean
  isNew: boolean
}

export type Destination =
  | { kind: 'append'; bundleId: string }
  | { kind: 'new'; reason?: string }

/** Enough to see the recent ones; older bundles are a Catalogue job. */
export const MAX_CHOICES = 6

const NEW_CHOICE = (isDefault: boolean): FilingChoice => ({
  key: '__new__',
  label: 'New bundle',
  target: { kind: 'new' },
  isDefault,
  isNew: true,
})

export function filingChoices(
  destination: Destination,
  openBundles: { id: string; intent: string }[],
  max: number = MAX_CHOICES,
): FilingChoice[] {
  const choices: FilingChoice[] = []

  if (destination.kind === 'append') {
    const active = openBundles.find((b) => b.id === destination.bundleId)
    choices.push({
      key: destination.bundleId,
      label: active?.intent ?? destination.bundleId,
      target: { kind: 'active' },
      isDefault: true,
      isNew: false,
    })
    // New sits right beside the default: it is the most common alternative.
    choices.push(NEW_CHOICE(false))
  } else {
    choices.push(NEW_CHOICE(true))
  }

  for (const bundle of openBundles) {
    if (choices.length >= max) break
    // The active bundle is already the default; listing it again would put
    // the same bundle in the cycle twice.
    if (destination.kind === 'append' && bundle.id === destination.bundleId) continue
    choices.push({
      key: bundle.id,
      label: bundle.intent,
      target: { kind: 'bundle', id: bundle.id },
      isDefault: false,
      isNew: false,
    })
  }

  return choices
}
