import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Where Bundles live in production.
 *
 * BundleStore deliberately has no default root — it must always be told one —
 * so this is the single place that knows the real location, and no test can
 * reach it by accident.
 */
export function defaultBundleRoot(env: NodeJS.ProcessEnv = process.env): string {
  return join(hiveHome(env), 'bundles')
}

/**
 * Where the Active Bundle pointer lives. Beside the bundles, never inside
 * them: anything listing the bundles directory would otherwise see it as one.
 */
export function defaultActiveBundleRecord(env: NodeJS.ProcessEnv = process.env): string {
  return join(hiveHome(env), 'active.json')
}

function hiveHome(env: NodeJS.ProcessEnv): string {
  return env['HIVEANNOTATE_HOME'] ?? join(homedir(), 'HiveAnnotate')
}
