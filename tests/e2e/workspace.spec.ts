import { test, expect } from './fixtures';
import { context } from './helpers';

const viewports = [320, 768, 1440];

test('coleções internas mantêm suas abas e hierarquia em mobile, tablet e desktop', async ({ browser }) => {
  test.setTimeout(120000);
  const user = await context(browser, 'Ana', 'ana_teste');
  try {
    for (const route of [
      '/app?status=OPEN', '/app?status=UNANSWERED', '/app?status=RESOLVED',
      '/atividades?tab=requests', '/atividades?tab=decision', '/atividades?tab=indications',
      '/atividades?tab=confirmed', '/atividades?tab=closed', '/salvos', '/salvos?tab=following',
      '/notificacoes',
    ]) {
      await user.page.goto(route);
      await expect(user.page.getByRole('heading', { level: 1 })).toBeVisible();
      if (route.startsWith('/app?')) {
        await expect(user.page.locator('.community-summary a[href="/salvos"]')).toHaveText('Pedidos salvos');
        await expect(user.page.locator('.community-summary strong')).toHaveText([/^\d+$/, /^\d+$/]);
      }
      for (const width of viewports) {
        await user.page.setViewportSize({ width, height: 850 });
        expect(await user.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${route} ${width}`).toBe(true);
        for (const active of await user.page.locator('.tabs a[aria-current="page"]').all()) {
          await expect(active).toBeInViewport({ ratio: 1 });
        }
        await user.page.screenshot({ path: `test-results/workspace-${route.replaceAll('/', '-').replaceAll('?', '-').replaceAll('=', '-')}-${width}.png`, fullPage: true });
      }
    }
  } finally {
    await user.ctx.close();
  }
});

test('configurações agrupam operações sem esconder formulários e preservam o teclado', async ({ browser }) => {
  const user = await context(browser, 'Ana', 'ana_teste');
  try {
    for (const [route, expected] of [['/preferencias', 3], ['/conta', 6]] as const) {
      await user.page.goto(route);
      await expect(user.page.locator('.settings-section')).toHaveCount(expected);
      await expect(user.page.locator('form form')).toHaveCount(0);
      for (const width of viewports) {
        await user.page.setViewportSize({ width, height: 600 });
        expect(await user.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const sections = await user.page.locator('.settings-section').all();
        for (const section of sections) {
          await expect(section.getByRole('heading', { level: 2 })).toBeVisible();
        }
        await user.page.screenshot({ path: `test-results/workspace-settings-${route.slice(1)}-${width}.png`, fullPage: true });
      }
      const control = user.page.locator('.settings-section input:not([type="hidden"]), .settings-section button').first();
      await user.page.keyboard.press('Tab');
      await control.focus();
      await expect(control).toBeFocused();
      await expect(control).toHaveCSS('outline-style', 'solid');
    }
  } finally {
    await user.ctx.close();
  }
});
