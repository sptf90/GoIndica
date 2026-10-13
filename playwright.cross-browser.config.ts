import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const localWebkitLibraries = [
  'libhidapi-hidraw.so.0',
  'libenchant-2.so.2',
  'libmanette-0.2.so.0',
].map((name) => join(process.cwd(), '.test-tools/webkit-libs/usr/lib/x86_64-linux-gnu', name));
const webkitPreload =
  process.env.GOINDICA_WEBKIT_PRELOAD ||
  (process.platform === 'linux' &&
  process.arch === 'x64' &&
  localWebkitLibraries.every((file) => existsSync(file))
    ? localWebkitLibraries.join(':')
    : undefined);
export default defineConfig({
  testDir: 'tests/e2e-cross',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'android-chrome',
      testMatch: '**/mobile-ux.spec.ts',
      use: { ...devices['Pixel 7'], browserName: 'chromium' },
    },
    {
      name: 'ios-safari',
      testMatch: '**/mobile-ux.spec.ts',
      use: { ...devices['iPhone 13'], browserName: 'webkit' },
    },
    { name: 'firefox', testIgnore: '**/mobile-ux.spec.ts', use: { browserName: 'firefox' } },
    {
      name: 'webkit',
      testIgnore: '**/mobile-ux.spec.ts',
      use: {
        browserName: 'webkit',
        launchOptions: webkitPreload
          ? {
              env: {
                ...Object.fromEntries(
                  Object.entries(process.env).flatMap(([key, value]) =>
                    value === undefined ? [] : [[key, value]],
                  ),
                ),
                LD_PRELOAD: webkitPreload,
              },
            }
          : undefined,
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'tsx tests/e2e/start-harness.ts',
        url: 'http://localhost:3100',
        reuseExistingServer: false,
        timeout: 60000,
      },
});
