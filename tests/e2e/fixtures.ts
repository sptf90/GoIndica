import { test as base, expect } from '@playwright/test';
export const test = base.extend<{ limitsReset: void }>({
  limitsReset: [
    async ({ request }, use) => {
      await request.post('http://localhost:3456/test-reset-limits');
      await use();
    },
    { auto: true },
  ],
});
export { expect };
