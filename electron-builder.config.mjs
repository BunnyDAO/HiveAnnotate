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
  mac: {
    target: 'dir',
    category: 'public.app-category.developer-tools',
    // A menu-bar background app: no dock tile, no Cmd-Tab entry.
    extendInfo: {
      LSUIElement: true,
      NSCameraUsageDescription: null,
    },
  },
}
