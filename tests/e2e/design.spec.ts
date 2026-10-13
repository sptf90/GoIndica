import { test, expect } from '@playwright/test';
import { context } from './helpers';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];

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
      expect(appearance.canvas).toBe(width < 768 ? 'rgb(255, 255, 255)' : 'rgb(245, 246, 244)');
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
      expect(illustration.height).toBe(64);
      await ana.page.screenshot({
        path: `test-results/prototipo-pedido-vazio-${width}.png`,
        fullPage: true,
      });
    }
  } finally {
    await ana.ctx.close();
  }
});

test('barra inferior possui quatro destinos e administração continua acessível pelo perfil', async ({
  browser,
}) => {
  const admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    for (const width of [320, 375, 390, 430]) {
      await admin.page.setViewportSize({ width, height: 850 });
      await admin.page.goto('/app');
      const nav = admin.page.locator('.bottom-nav');
      await expect(nav).toBeVisible();
      await expect(nav.getByRole('link')).toHaveCount(4);
      await expect(nav.getByRole('link', { name: 'Início', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await nav.getByRole('link', { name: 'Atividades', exact: true }).click();
      await expect(admin.page).toHaveURL(/\/atividades$/);
      await expect(nav.getByRole('link', { name: 'Atividades', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await nav.getByRole('link', { name: 'Perfil', exact: true }).focus();
      await admin.page.keyboard.press('Enter');
      await expect(admin.page).toHaveURL(/\/perfil$/);
      await admin.page
        .locator('.profile-menu')
        .getByRole('link', { name: 'Administração', exact: true })
        .click();
      await expect(admin.page).toHaveURL(/\/admin$/);
      expect(
        await admin.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
    }
    for (const width of [768, 1024, 1440]) {
      await admin.page.setViewportSize({ width, height: 850 });
      await expect(admin.page.locator('.desktop-nav')).toBeVisible();
      await expect(admin.page.locator('.bottom-nav')).not.toBeVisible();
      await expect(
        admin.page
          .locator('.desktop-nav')
          .getByRole('link', { name: 'Administração', exact: true }),
      ).toBeVisible();
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
