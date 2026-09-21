import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    build: {
      outDir: resolve(__dirname, 'out/main'),
      rollupOptions: { input: resolve(__dirname, 'src/main/index.ts') },
    },
  },
  preload: {
    build: {
      outDir: resolve(__dirname, 'out/preload'),
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts'),
        // CommonJS on purpose. The package is "type": "module", so the default
        // emit is .mjs — and Electron only loads an ESM preload with the
        // sandbox turned off. Emitting CJS keeps the sandbox on.
        output: { format: 'cjs', entryFileNames: 'index.cjs' },
      },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    build: {
      // Must sit beside out/main, which is what the main process resolves
      // against at runtime. The default lands it outside the package.
      outDir: resolve(__dirname, 'out/renderer'),
      rollupOptions: { input: resolve(__dirname, 'src/renderer/index.html') },
    },
  },
})
