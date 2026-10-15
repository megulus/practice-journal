import { defineConfig } from 'vitest/config'

// Plain Node, not jsdom: core code must not depend on a browser.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
