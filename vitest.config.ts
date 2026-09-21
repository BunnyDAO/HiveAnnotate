import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Plain Node. No Electron test harness — the whole point of the core
    // boundary is that core runs without one.
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
})
