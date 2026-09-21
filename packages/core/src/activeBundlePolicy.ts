/**
 * Where does the next Capture go?
 *
 * The user is never asked. There is at most one Active Bundle and a Capture
 * appends to it — unless it has gone stale, in which case a fresh Bundle opens
 * and the capture bar says so.
 *
 * Pure, with the clock passed in. This is the cheapest thing in the codebase to
 * test exhaustively and the decision most likely to silently corrupt a Bundle:
 * a mis-filed Capture is not discovered until an agent reads a Bundle that lies
 * about itself.
 */

export interface ActiveBundle {
  id: string
  lastCaptureAt: Date
}

export type CaptureDestination =
  | { kind: 'append'; bundleId: string }
  | { kind: 'new'; reason: 'no-active-bundle' | 'stale' }

/** Twenty minutes with no Captures and the Active Bundle is considered stale. */
export const STALE_AFTER_MS = 20 * 60 * 1000

export function decideDestination(
  active: ActiveBundle | null,
  now: Date,
  staleAfterMs: number = STALE_AFTER_MS,
): CaptureDestination {
  if (!active) return { kind: 'new', reason: 'no-active-bundle' }

  const age = now.getTime() - active.lastCaptureAt.getTime()

  // A non-monotonic clock (NTP correction, sleep/wake) can make the last
  // capture look like it happened in the future, and an invalid timestamp
  // makes the age NaN. Neither is the user's doing, and splitting their
  // evidence across two Bundles is a far worse outcome than keeping one open
  // slightly too long. Both fall through to append.
  if (Number.isNaN(age) || age < 0) return { kind: 'append', bundleId: active.id }

  // At exactly the threshold the Bundle is stale. Pinned by test: an
  // unspecified boundary is where an off-by-one quietly mis-files work.
  if (age >= staleAfterMs) return { kind: 'new', reason: 'stale' }

  return { kind: 'append', bundleId: active.id }
}
