import { defineConfig } from '@playwright/test';
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
    baseURL: 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
    {
      name: 'webkit',
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
  webServer: {
    command: 'tsx tests/e2e/start-harness.ts',
    url: 'http://localhost:3100',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
