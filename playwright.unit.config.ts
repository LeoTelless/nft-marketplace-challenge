import { defineConfig } from '@playwright/test'

/**
 * Unit tests (`npm run test:unit`): pure functions next to their source (`src/**\/*.test.ts`),
 * run by the Playwright runner in Node. No browser and no web server are started.
 */
export default defineConfig({
  testDir: './src',
  testMatch: /\.test\.ts$/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: [['line']],
})
