import { test, expect } from './fixtures';
import { context } from './helpers';
const widths = [320, 375, 390, 430, 768, 1024, 1200, 1280, 1440];

test('rolagem natural e navegação contextual em todos os tamanhos', async ({ browser }) => {
  test.setTimeout(120000);
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    await ana.page.goto('/pedidos/novo');
    await ana.page
      .getByLabel('O que você está procurando?')
      .fill('Pedido para verificar navegação e rolagem natural');
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const request = new URL(ana.page.url()).pathname;
    for (const width of widths) {
      for (const height of [600, 850]) {
        await ana.page.setViewportSize({ width, height });
        for (const route of [
          '/app',
          '/ranking',
          '/atividades',
          '/perfil',
          '/perfil/ana_teste',
          '/pedidos/novo',
          request,
          request + '/editar',
          '/salvos',
          '/notificacoes',
          '/preferencias',
          '/conta',
        ]) {
          await ana.page.goto(route);
          await expect(ana.page.getByRole('heading', { level: 1 })).toBeVisible();
          expect(
            await ana.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${route}: ${width}x${height}`,
          ).toBe(true);
          expect(
            await ana.page.locator('.app-content').evaluate((el) => getComputedStyle(el).overflowY),
          ).toBe('visible');
          const focus = ['/pedidos/novo', request + '/editar', '/preferencias', '/conta'].includes(
            route,
          );
          if (width < 768 && !focus) {
            const nav = ana.page.locator('.bottom-nav');
            await expect(nav).toBeInViewport({ ratio: 1 });
            const bounds = (await nav.boundingBox())!;
            expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
          } else await expect(ana.page.locator('.bottom-nav')).not.toBeVisible();
          if (focus)
            await expect(ana.page.getByRole('link', { name: 'Voltar', exact: true })).toBeVisible();
        }
        await ana.page.goto('/app');
        await expect(ana.page.getByRole('heading', { level: 1 })).toBeVisible();
        await ana.page.screenshot({
          path: `test-results/mobile-first-feed-${width}x${height}.png`,
          fullPage: true,
        });
      }
    }
  } finally {
    await ana.ctx.close();
  }
});

test('conteúdo extenso, edição e autocomplete não ficam atrás da navegação', async ({
  browser,
}) => {
  const admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    await admin.page.setViewportSize({ width: 390, height: 600 });
    await admin.page.goto('/perfil');
    await admin.page.locator('.profile-editor > summary').click();
    await admin.page
      .getByRole('button', { name: 'Sair da conta', exact: true })
      .scrollIntoViewIfNeeded();
    await expect(
      admin.page.getByRole('button', { name: 'Sair da conta', exact: true }),
    ).toBeInViewport({ ratio: 1 });
    expect(await admin.page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const nav = (await admin.page.locator('.bottom-nav').boundingBox())!;
    const logout = (await admin.page
      .getByRole('button', { name: 'Sair da conta', exact: true })
      .boundingBox())!;
    expect(logout.y + logout.height).toBeLessThanOrEqual(nav.y);
    const city = admin.page.getByRole('combobox', { name: 'Cidade', exact: true });
    await city.fill('Bom Jesus');
    const list = admin.page.getByRole('listbox');
    await expect(list).toBeVisible();
    const options = (await list.boundingBox())!;
    expect(options.y).toBeGreaterThanOrEqual(60);
    expect(options.y + options.height).toBeLessThanOrEqual(nav.y);
    await admin.page.getByRole('option', { name: 'Bom Jesus RS', exact: true }).click();
    await expect(city).toHaveValue('Bom Jesus — RS');
    await admin.page
      .locator('.bottom-nav')
      .getByRole('link', { name: 'Início', exact: true })
      .click();
    await expect(admin.page.getByRole('heading', { level: 1 })).toBeInViewport({ ratio: 1 });
    expect(await admin.page.evaluate(() => scrollY)).toBe(0);
  } finally {
    await admin.ctx.close();
  }
});
