/**
 * App identity, single-sourced.
 *
 * The bundle identifier is read by the Electron packaging config so the value
 * the app ships with cannot drift from the value recorded here.
 *
 * Do not change BUNDLE_ID. macOS keys the Screen Recording (TCC) grant to the
 * signing identity, bundle identifier included: changing it revokes the user's
 * permission and re-prompts them. See docs/research/macos-capture-constraints.md
 * and issue hive-v1-03.
 */

export const BUNDLE_ID = 'io.hiveop.hiveannotate'

export const APP_NAME = 'HiveAnnotate'
