import { randomUUID } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_APP_URL || 'http://127.0.0.1:3000';
const e2eStorageDir = `.tmp/e2e-storage-${randomUUID()}`;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_APP_URL ? undefined : {
    command: `STORAGE_DRIVER=local LOCAL_STORAGE_DIR=${e2eStorageDir} SESSION_SECRET=e2e-session-secret NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 node scripts/e2e-server.mjs`,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
