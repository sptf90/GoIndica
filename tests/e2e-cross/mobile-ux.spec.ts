import { test, expect } from '@playwright/test';
import { login } from '../e2e/helpers';

// Network failures are injected by Playwright; the PWA lifecycle has its own test.
// WebKit may bypass page interception for requests from a controlled document.
test.use({ serviceWorkers: 'block' });

const widths = [320, 375, 390, 430, 768, 1024, 1440];
test('touch, navegação contextual, histórico e safe areas em Android/iOS', async ({
  page,
}, info) => {
  test.setTimeout(120000);
  await login(page, 'Rita', 'rita_mobile');
  for (const width of widths) {
    await page.setViewportSize({ width, height: 844 });
    for (const route of [
      '/app',
      '/perfil',
      '/salvos',
      '/notificacoes',
      '/ranking',
      '/preferencias',
      '/pedidos/novo',
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route}: ${width}`,
      ).toBe(true);
      expect(await page.locator('meta[name="viewport"]').getAttribute('content')).toContain(
        'viewport-fit=cover',
      );
      if (
        width < 768 &&
        ['/app', '/perfil', '/salvos', '/notificacoes', '/ranking'].includes(route)
      ) {
        await expect(page.locator('.bottom-nav')).toBeInViewport({ ratio: 1 });
        const heights = await page
          .locator('.bottom-nav a')
          .evaluateAll((items) => items.map((item) => item.getBoundingClientRect().height));
        expect(heights.every((height) => height >= 44)).toBe(true);
      } else await expect(page.locator('.bottom-nav')).not.toBeVisible();
    }
    await page.goto('/app');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`feed-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/app');
  await page.getByLabel('Buscar pedidos').fill('Peça de bicicleta');
  await page.locator('.feed-create').tap();
  await expect(page).toHaveURL(/\/pedidos\/novo/);
  await expect(page.getByLabel('O que você está procurando?')).toHaveValue('Peça de bicicleta');
  await expect(page.locator('.bottom-nav')).toHaveCount(0);
  await page
    .getByLabel('O que você está procurando?')
    .fill('Peça de bicicleta para revisão mobile · ' + info.project.name);
  await page.getByRole('button', { name: 'Publicar pedido' }).tap();
  await page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
  await expect(
    page.getByRole('heading', { name: 'Sua cidade ainda não respondeu.' }),
  ).toBeVisible();
  await expect(page.locator('.request-journey [aria-current="step"]')).toHaveText('1Procurando');
  await page.locator('.request-options > summary').tap();
  await page.getByRole('button', { name: 'Salvar pedido', exact: true }).tap();
  await expect(page.getByRole('button', { name: 'Remover dos salvos' })).toBeVisible();
  await page.locator('.bottom-nav').getByRole('link', { name: 'Perfil', exact: true }).tap();
  await page
    .locator('.profile-menu')
    .getByRole('link', { name: 'Pedidos salvos', exact: true })
    .tap();
  await expect(page.locator('.request-list')).toContainText(info.project.name);
  await page.goBack();
  await expect(page).toHaveURL(/\/perfil$/);
  await page.screenshot({ path: info.outputPath('profile-mobile.png'), fullPage: true });
});

test('busca tem recuperação de erro; senha pode ser revelada sem perder o valor', async ({
  page,
}) => {
  await page.goto('/entrar');
  await page.getByLabel('Senha', { exact: true }).fill('Uma senha de teste 123');
  await page.getByRole('button', { name: 'Mostrar senha' }).tap();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ocultar senha' }).tap();
  await expect(page.getByLabel('Senha', { exact: true })).toHaveValue('Uma senha de teste 123');
  await expect(page.getByLabel('Senha', { exact: true })).toHaveAttribute('type', 'password');
  await login(page, 'Rita', 'rita_mobile');
  await page.locator('.city-disclosure > summary').tap();
  let failed = true;
  await page
    .context()
    .route('**/api/cities?**', (route) =>
      failed ? route.fulfill({ status: 503, json: { error: 'indisponível' } }) : route.continue(),
    );
  await page.getByRole('combobox').fill('Recife PE');
  await expect(page.locator('.city-selector')).toContainText(
    'Não foi possível carregar as cidades',
  );
  failed = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).tap();
  await page.getByRole('option', { name: 'Recife PE', exact: true }).tap();
  await page
    .locator('.city-disclosure-content')
    .getByRole('button', { name: 'Buscar na cidade', exact: true })
    .tap();
  await expect(page).toHaveURL(/city=2611606/);
});
