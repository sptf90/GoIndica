import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { test, expect } from './fixtures';
import { context } from './helpers';

const fixtures = JSON.parse(execFileSync(process.execPath, [
  '--import', 'tsx', fileURLToPath(new URL('./render-visual-fixtures.ts', import.meta.url)),
], { encoding: 'utf8' })) as { statuses: string; avatars: string; error: string };

const widths = [320, 375, 390, 430, 768, 1024, 1200, 1280, 1440];

// Render the real primitives with the application's loaded CSS, without creating test routes.
test('status têm contraste AA e fotos e iniciais seguem o mesmo contrato responsivo', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.locator('main').evaluate((el, html) => { el.innerHTML = html; }, fixtures.statuses + fixtures.avatars);
  await expect(page.locator('.status')).toHaveCount(5);
  await expect(page.locator('.avatar')).toHaveCount(8);
  for (const status of await page.locator('.status').all()) {
    for (const hover of [false, true]) {
      if (hover) await status.hover();
      const ratio = await status.evaluate((el) => {
        const luminance = (color: string) => {
          const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map((value) => {
            const v = value / 255;
            return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
          });
          return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
        };
        const style = getComputedStyle(el);
        const a = luminance(style.color), b = luminance(style.backgroundColor);
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio, await status.innerText()).toBeGreaterThanOrEqual(4.5);
    }
  }
  for (const width of widths) {
    await page.setViewportSize({ width, height: 600 });
    const dimensions = await page.locator('.avatar').evaluateAll((els) => els.map((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height, fit: getComputedStyle(el).objectFit };
    }));
    const expected = width < 768 ? [36, 64, 64, 32] : [40, 72, 80, 32];
    dimensions.forEach((rect, i) => {
      expect(rect.width).toBe(expected[Math.floor(i / 2)]);
      expect(rect.height).toBe(rect.width);
      expect(rect.fit).toBe('cover');
    });
  }
});

test('fallback de erro mantém destino focável, reflow e botão de recuperação', async ({ page }) => {
  await page.goto('/entrar');
  await page.locator('main').evaluate((el, html) => { el.outerHTML = html; }, fixtures.error);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 600 });
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('#conteudo')).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.getByRole('link', { name: 'Pular para o conteúdo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Tentar novamente' })).toBeFocused();
});

test('etapas legíveis, controles compactos e reflow com texto ampliado', async ({ browser }) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    const { page } = ana;
    await page.goto('/pedidos/novo');
    await page.getByLabel('O que você está procurando?').fill('Pedido para validar etapas e controles');
    await page.getByRole('button', { name: 'Publicar pedido' }).click();
    await page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    await expect(page.locator('.request-journey li')).toHaveCount(3);
    for (const width of widths) {
      await page.setViewportSize({ width, height: 600 });
      const items = await page.locator('.request-journey li').evaluateAll((els) => els.map((el) => {
        const box = el.getBoundingClientRect();
        return { x: box.x, y: box.y, right: box.right, bottom: box.bottom, font: parseFloat(getComputedStyle(el).fontSize) };
      }));
      expect(items).toHaveLength(3);
      items.forEach((item, i) => {
        expect(item.font).toBeGreaterThanOrEqual(12);
        expect(item.right).toBeLessThanOrEqual(width);
        for (const other of items.slice(i + 1)) {
          expect(item.right <= other.x || other.right <= item.x || item.bottom <= other.y || other.bottom <= item.y).toBe(true);
        }
      });
      if (width < 768) {
        for (const control of await page.locator('.request-actions .button, .request-options > summary').all()) {
          const box = (await control.boundingBox())!;
          expect(box.height).toBeGreaterThanOrEqual(44);
          expect(box.width).toBeGreaterThanOrEqual(44);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: `test-results/etapas-controles-${width}.png`, fullPage: true });
    }
    const request = page.url();
    for (const route of [request, '/app', '/perfil', '/ranking', '/preferencias', '/conta', '/pedidos/novo']) {
      await page.goto(route);
      await page.setViewportSize({ width: 320, height: 600 });
      await page.evaluate(() => {
        const sizes = [...document.querySelectorAll<HTMLElement>('body *')].map((el) => [el, getComputedStyle(el).fontSize] as const);
        sizes.forEach(([el, size]) => { el.style.fontSize = `${parseFloat(size) * 2}px`; });
      });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
      if (await page.locator('.bottom-nav').isVisible()) {
        await expect(page.locator('.bottom-nav')).toBeInViewport({ ratio: 1 });
        await expect(page.locator('.bottom-nav .nav-label')).toHaveCount(4);
        for (const label of await page.locator('.bottom-nav .nav-label').all()) {
          expect(await label.evaluate((el) => {
            const text = document.createRange();
            text.selectNodeContents(el);
            const bounds = el.getBoundingClientRect();
            return [...text.getClientRects()].every((rect) => rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1);
          }), 'Rótulo da navegação sem colisão').toBe(true);
        }
      }
      await page.screenshot({ path: `test-results/texto-200-${new URL(route, page.url()).pathname.replaceAll('/', '-')}.png`, fullPage: true });
    }
  } finally {
    await ana.ctx.close();
  }
});

test('skip link da página ausente não duplica landmarks dentro do shell', async ({ browser, page }) => {
  for (const route of ['/endereco-inexistente', '/privacidade', '/termos']) {
    await page.goto(route);
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.locator('#conteudo')).toHaveCount(1);
  }
  await page.goto('/endereco-inexistente');
  await page.getByRole('link', { name: 'Pular para o conteúdo' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo')).toBeFocused();
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    await ana.page.goto('/pedidos/00000000-0000-4000-8000-000000000000');
    await expect(ana.page.getByRole('heading', { level: 1 })).toHaveText('Pedido ou página não encontrado.');
    await expect(ana.page.getByRole('main')).toHaveCount(1);
    await expect(ana.page.locator('#conteudo')).toHaveCount(1);
  } finally {
    await ana.ctx.close();
  }
});
