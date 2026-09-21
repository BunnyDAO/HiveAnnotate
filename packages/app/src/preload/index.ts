import { contextBridge } from 'electron'
import { APP_NAME, BUNDLE_ID } from '@hiveannotate/core'

contextBridge.exposeInMainWorld('hive', {
  appName: APP_NAME,
  bundleId: BUNDLE_ID,
})
