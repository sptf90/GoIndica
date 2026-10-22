import { test, expect } from './fixtures';
import { context } from './helpers';

test('menu da conta abre ao passar o mouse no nome e permite sair', async ({ browser }) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    const { page } = ana;
    for (const width of [768, 1024, 1200, 1440]) {
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
      const logout = sidebar.getByRole('button', { name: 'Sair', exact: true });
      const target = (await logout.boundingBox())!;
      await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 20 });
      await expect(logout).toBeVisible();
      await profile.hover();
      await page.screenshot({ path: `test-results/account-menu-${width}.png` });
    }
    await page.locator('.app-sidebar .profile-link').hover();
    await page.locator('.app-sidebar').getByRole('button', { name: 'Sair', exact: true }).click();
    await page.waitForURL((url) => url.pathname === '/');
  } finally {
    await ana.ctx.close();
  }
});

test('conta abre por teclado e clique, fecha com Escape e conserva o acesso ao perfil', async ({ browser }) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    const { page } = ana;
    for (const width of [768, 1024, 1200, 1440]) {
      await page.setViewportSize({ width, height: 600 });
      await page.goto('/app');
      await page.mouse.move(width - 1, 0);
      const trigger = page.getByRole('button', { name: 'Opções da conta' });
      const profile = page.locator('.account-popover').getByRole('link', { name: 'Meu perfil' });
      await trigger.focus();
      await expect(trigger).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Tab');
      expect(await page.locator('.account-popover').evaluate((el) => el.contains(document.activeElement))).toBe(false);
      await trigger.focus();
      await page.keyboard.press('Enter');
      await expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Tab');
      await expect(profile).toBeFocused();
      const popup = (await page.locator('.account-popover').boundingBox())!;
      expect(popup.x).toBeGreaterThanOrEqual(0);
      expect(popup.y).toBeGreaterThanOrEqual(0);
      expect(popup.x + popup.width).toBeLessThanOrEqual(width);
      expect(popup.y + popup.height).toBeLessThanOrEqual(600);
      await page.keyboard.press('Escape');
      await expect(profile).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await expect(profile).toBeVisible();
      await trigger.click();
      await expect(profile).toBeHidden();
      await trigger.click();
      await profile.click();
      await expect(page).toHaveURL(/\/perfil$/);
      await expect(profile).toBeHidden();
    }
  } finally {
    await ana.ctx.close();
  }
});

test('conta aceita toque e fecha ao tocar fora', async ({ browser }) => {
  const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 1024, height: 600 } });
  const page = await ctx.newPage();
  try {
    const { login } = await import('./helpers');
    await login(page, 'Ana', 'ana_teste');
    const trigger = page.getByRole('button', { name: 'Opções da conta' });
    await trigger.tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('heading', { level: 1 }).tap();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.tap();
    await page.locator('.account-popover').getByRole('link', { name: 'Meu perfil' }).tap();
    await expect(page).toHaveURL(/\/perfil$/);
  } finally {
    await ctx.close();
  }
});


test('sidebar em orientação horizontal mantém navegação, criação e conta acessíveis', async ({ browser }) => {
  const admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    const { page } = admin;
    for (const width of [850, 1200]) {
      await page.setViewportSize({ width, height: 390 });
      await page.goto('/app');
      const sidebar = page.locator('.app-sidebar');
      const account = sidebar.getByRole('button', { name: 'Opções da conta' });
      await expect(account).toBeInViewport({ ratio: 1 });
      await expect(sidebar.getByRole('link', { name: 'Novo pedido' })).toBeInViewport({ ratio: 1 });
      const adminLink = sidebar.getByRole('link', { name: 'Administração' });
      await adminLink.focus();
      await expect(adminLink).toBeInViewport({ ratio: 1 });
      await account.click();
      await expect(sidebar.getByRole('link', { name: 'Meu perfil' })).toBeInViewport({ ratio: 1 });
      await expect(sidebar.getByRole('button', { name: 'Sair', exact: true })).toBeInViewport({ ratio: 1 });
      await page.screenshot({ path: `test-results/menu-horizontal-${width}.png` });
      await page.keyboard.press('Escape');
      await expect(account).toBeFocused();
    }
  } finally {
    await admin.ctx.close();
  }
});
