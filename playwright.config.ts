import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'tsx tests/e2e/start-harness.ts',
        url: 'http://localhost:3100',
        reuseExistingServer: false,
        timeout: 60000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 15000 },
      },
});
