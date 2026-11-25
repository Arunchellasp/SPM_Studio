/**
 * Step 36 · UI tests of the real app against the real C runtime: Electron (the built studio) talks to spm_rt
 * over ws://127.0.0.1 — no browser simulator, no mock. spm_rt must be built first (runtime/build).
 *   npm run test:rt          (SPM_RT_BIN=… to use another spm_rt binary)
 */
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'e2e-rt',
  outputDir: 'test-results/rt-artifacts',
  workers: 1, // one app, one runtime, one port
  timeout: 120_000,
  reporter: [['list'], ['json', { outputFile: 'test-results/rt-report.json' }]]
})
