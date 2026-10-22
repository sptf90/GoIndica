import { test, expect } from './fixtures';
import { context } from './helpers';

test('menu da conta abre ao passar o mouse no nome e permite sair', async ({ browser }) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    const { page } = ana;
    for (const width of [1024, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto('/app');
      const sidebar = page.locator('.app-sidebar');
      await expect(
        sidebar.locator('.desktop-nav').getByRole('link', { name: 'Perfil' }),
      ).toHaveCount(0);
      const profile = sidebar.getByRole('link', { name: 'Meu perfil', exact: true });
      await expect(profile).toBeHidden();
      await sidebar.locator('.profile-link').hover();
      await expect(profile).toBeVisible();
      await expect(sidebar.locator('.account-popover')).toHaveCSS('opacity', '1');
      await expect(sidebar.getByRole('button', { name: 'Sair', exact: true })).toBeVisible();
      await page.screenshot({ path: `test-results/account-menu-${width}.png` });
    }
    await page.locator('.app-sidebar .profile-link').hover();
    await page.locator('.app-sidebar').getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
  } finally {
    await ana.ctx.close();
  }
});
