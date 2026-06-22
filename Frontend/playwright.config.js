import { defineConfig, devices } from '@playwright/test'

// E2E runs against a LIVE stack (frontend dev server on 3001 proxying /v1 to the
// backend on 8080). Bring the stack up first (see docs/E2E.md) or use the
// e2e CI workflow. Set E2E_BASE_URL to point elsewhere.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3001',
    headless: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
