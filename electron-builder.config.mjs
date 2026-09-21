// electron-builder reads this with plain Node, which strips TypeScript types
// natively — so the bundle identifier is imported from core rather than
// duplicated here. hive-v1-03 (Developer ID signing) depends on it never
// drifting: macOS keys the Screen Recording grant to this value.
import { BUNDLE_ID, APP_NAME } from './packages/core/src/index.ts'

export default {
  appId: BUNDLE_ID,
  productName: APP_NAME,
  // electron-builder runs with packages/app as its project directory, so every
  // path here is relative to that, not to the repo root.
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: ['out/**/*', 'build/**/*', 'package.json'],
  // macOS will not execute a binary from inside an asar archive, so the native
  // helper is unpacked beside it. Without this the packaged app cannot find a
  // window, check a permission, or see Secure Input — while dev, which has no
  // asar, works perfectly.
  asarUnpack: ['build/hive-helper'],
  mac: {
    target: 'dir',
    category: 'public.app-category.developer-tools',
    // Hardened runtime is required for notarization; the entitlements keep V8
    // working under it. Deliberately not sandboxed — see entitlements.mac.plist.
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist',
    // Signing identity comes from the environment, never from this file:
    //   HIVE_SIGNING_IDENTITY="HiveAnnotate Local Signing"   (free, local — see docs/signing.md)
    //   HIVE_SIGNING_IDENTITY="Developer ID Application: …"  (distribution)
    // Unset, electron-builder falls back to ad-hoc signing, which works but
    // costs the Screen Recording grant on every rebuild.
    identity: process.env.HIVE_SIGNING_IDENTITY ?? null,
    // Notarization only runs when Apple credentials are present in the
    // environment (APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID).
    notarize: Boolean(process.env.APPLE_TEAM_ID),
    // A menu-bar background app: no dock tile, no Cmd-Tab entry.
    extendInfo: {
      LSUIElement: true,
      NSCameraUsageDescription: null,
    },
  },
}
