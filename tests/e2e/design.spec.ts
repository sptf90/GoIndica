import { test, expect } from '@playwright/test';
import { context } from './helpers';

const widths = [320, 375, 390, 414, 768, 1024, 1280, 1440];

test('identidade GoIndica e contexto do pedido se adaptam aos oito tamanhos', async ({
  browser,
}) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    await ana.page.goto('/pedidos/novo');
    await ana.page.getByLabel('O que você está procurando?').fill('Onde tem farinha para pizza?');
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    await expect(
      ana.page.getByRole('heading', { name: 'Sua cidade ainda não respondeu.' }),
    ).toBeVisible();
    await expect(ana.page.getByRole('heading', { name: 'Área da busca' })).toBeVisible();
    await expect(ana.page.getByRole('button', { name: 'Ver indicações', exact: true })).toHaveCount(
      0,
    );
    await expect(
      ana.page.getByRole('button', { name: 'Encontrei neste local', exact: true }),
    ).toHaveCount(0);
    await expect(ana.page.getByRole('link', { name: 'Indicar local' })).toHaveCount(0);
    await expect(ana.page.getByRole('link', { name: 'Editar pedido', exact: true })).toBeVisible();
    for (const width of widths) {
      await ana.page.setViewportSize({ width, height: 1000 });
      const appearance = await ana.page.evaluate(async () => {
        await document.fonts.ready;
        const main = document.querySelector('main')!;
        return {
          canvas: getComputedStyle(document.body).backgroundColor,
          surface: getComputedStyle(main).backgroundColor,
          font: getComputedStyle(main).fontFamily,
          loaded: document.fonts.check('16px "Inter Variable"'),
          fits: document.documentElement.scrollWidth <= innerWidth,
        };
      });
      expect(appearance.canvas).toBe('rgb(244, 247, 241)');
      expect(appearance.surface).toBe('rgb(255, 255, 255)');
      expect(appearance.font).toContain('Inter Variable');
      expect(appearance.loaded).toBe(true);
      expect(appearance.fits, `${width}px`).toBe(true);
      const main = (await ana.page.locator('.app-main').boundingBox())!;
      expect(main.x).toBeGreaterThanOrEqual(16);
      expect(main.x + main.width).toBeLessThanOrEqual(width - 16);
      const content = (await ana.page.locator('.detail-content').boundingBox())!;
      const contextPanel = (await ana.page.locator('.request-context').boundingBox())!;
      if (width >= 1024) {
        expect(contextPanel.x).toBeGreaterThan(content.x + content.width);
        expect(Math.abs(contextPanel.y - content.y)).toBeLessThanOrEqual(1);
      } else {
        expect(contextPanel.y).toBeGreaterThan(content.y + content.height);
      }
      const illustration = (await ana.page
        .locator('.response-gate .location-illustration')
        .boundingBox())!;
      expect(illustration.height).toBe(104);
      await ana.page.screenshot({
        path: `test-results/prototipo-pedido-vazio-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    await ana.ctx.close();
  }
});

test('menu do celular navega, responde ao teclado e mantém acesso à administração', async ({
  browser,
}) => {
  const admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    const menu = admin.page.locator('.mobile-menu');
    const trigger = menu.locator('summary');
    for (const width of [320, 375, 390, 414]) {
      await admin.page.setViewportSize({ width, height: 850 });
      await expect(menu.locator('nav')).not.toBeVisible();
      await trigger.click();
      await expect(menu.locator('nav')).toBeVisible();
      await expect(menu.getByRole('link', { name: 'Administração', exact: true })).toBeVisible();
      await admin.page.screenshot({
        path: `test-results/prototipo-menu-${width}.png`,
        fullPage: true,
      });
      await menu.getByRole('link', { name: 'Ranking', exact: true }).focus();
      await admin.page.keyboard.press('Escape');
      await expect(menu.locator('nav')).not.toBeVisible();
      await expect(trigger).toBeFocused();
      await trigger.press('Enter');
      await expect(menu.locator('nav')).toBeVisible();
      // The dropdown covers the heading; click the visible surface below it.
      await admin.page.locator('.app-main').click({ position: { x: 8, y: 400 } });
      await expect(menu.locator('nav')).not.toBeVisible();
    }
    await trigger.click();
    await menu.getByRole('link', { name: 'Minhas atividades', exact: true }).click();
    await expect(admin.page).toHaveURL(/\/atividades$/);
    await expect(menu.locator('nav')).not.toBeVisible();
    await trigger.click();
    await menu.getByRole('link', { name: 'Administração', exact: true }).click();
    await expect(admin.page).toHaveURL(/\/admin$/);
    for (const width of [768, 1024, 1280, 1440]) {
      await admin.page.setViewportSize({ width, height: 850 });
      await expect(admin.page.locator('.desktop-nav')).toBeVisible();
      await expect(trigger).not.toBeVisible();
      expect(
        await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
  } finally {
    await admin.ctx.close();
  }
});

test('compartilhamento copia apenas a URL do pedido e oferece alternativa sem clipboard', async ({
  browser,
}) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    await ana.ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
    await ana.page.goto('/pedidos/novo');
    await ana.page
      .getByLabel('O que você está procurando?')
      .fill('Pedido para compartilhar com a cidade');
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = ana.page.url();
    await ana.page.goto(url + '?enviado=1&peoplePage=2');
    await ana.page.evaluate(() =>
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }),
    );
    await ana.page
      .getByRole('button', { name: 'Compartilhar com a comunidade', exact: true })
      .click();
    await expect(ana.page.getByRole('status').filter({ hasText: 'Link copiado.' })).toBeVisible();
    expect(await ana.page.evaluate(() => navigator.clipboard.readText())).toBe(url);
    await ana.page.evaluate(() =>
      Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }),
    );
    await ana.page.getByRole('button', { name: 'Compartilhar pedido', exact: true }).click();
    await expect(ana.page.getByLabel('Link do pedido', { exact: true })).toHaveValue(url);
    await ana.page.getByLabel('Link do pedido', { exact: true }).focus();
    expect(
      await ana.page
        .getByLabel('Link do pedido', { exact: true })
        .evaluate((input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!),
    ).toBe(url.length);
  } finally {
    await ana.ctx.close();
  }
});
