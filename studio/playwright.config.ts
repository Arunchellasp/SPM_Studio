/**
 * Automated UI tests (Playwright): the screens run in a real Chromium against the
 * Vite dev server (npm run web), at the design size 1920 × 1080.
 *   npm run test:ui
 */
import { defineConfig, devices } from '@playwright/test'

const PORT = 5180

export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/ui-artifacts', // keep Playwright from wiping the unit report in test-results/
  fullyParallel: true,
  reporter: [['list'], ['json', { outputFile: 'test-results/ui-report.json' }]],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1920, height: 1080 },
    // optional: use an already installed Chromium (set PW_CHROMIUM_PATH)
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {}
  },
  webServer: {
    command: `npx vite src/renderer --config vite.web.config.ts --port ${PORT} --strictPort --host 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  }
})
