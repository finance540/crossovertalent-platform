import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || process.env.STAGING_APP_URL || 'http://127.0.0.1:3000';

if (process.env.VERCEL_TOKEN) process.env.VERCEL_TOKEN = process.env.VERCEL_TOKEN.trim();
const allowVercelProjectSetup = process.env.CI === 'true' && Boolean(process.env.VERCEL_ORG_ID && process.env.VERCEL_PROJECT_ID);
const vercelSetupFlags = [
  ...(allowVercelProjectSetup ? ['--yes'] : []),
  ...(process.env.VERCEL_TOKEN ? ['--token "$VERCEL_TOKEN"'] : [])
].join(' ');

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
    command: `STORAGE_DRIVER=local LOCAL_STORAGE_DIR=.tmp/e2e-storage SESSION_SECRET=e2e-session-secret NEXT_PUBLIC_APP_URL=http://127.0.0.1:3000 npx vercel dev --listen 127.0.0.1:3000 ${vercelSetupFlags}`,
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
