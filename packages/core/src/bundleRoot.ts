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
  const home = env['HIVEANNOTATE_HOME']
  return home ? join(home, 'bundles') : join(homedir(), 'HiveAnnotate', 'bundles')
}
