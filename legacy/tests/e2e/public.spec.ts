import { test, expect } from '@playwright/test';
const widths = [320, 375, 390, 414, 768, 1024, 1280, 1440];
test('páginas públicas usam rolagem natural e rodapé acessível fora do painel do app', async ({
  page,
}) => {
  test.setTimeout(90000);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 600 });
    for (const route of [
      '/',
      '/entrar',
      '/cadastro',
      '/recuperar-senha',
      '/privacidade',
      '/termos',
    ]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.locator('.app-shell, .app-main, .app-content')).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${route}: ${width}px sem rolagem horizontal`,
      ).toBe(true);
      const footer = page.getByRole('contentinfo');
      await expect(footer).toBeVisible();
      await footer.scrollIntoViewIfNeeded();
      // The document's scroll height rounds fractional pixels at its bottom edge.
      await expect(footer).toBeInViewport({ ratio: 0.99 });
      expect(
        await page.evaluate(() => scrollY),
        `${route}: ${width}px com rolagem da página`,
      ).toBeGreaterThan(0);
      await expect(footer.getByRole('link', { name: 'Termos de uso' })).toBeInViewport({
        ratio: 1,
      });
    }
  }
});
test('landing explica o ciclo e não promete estoque', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Pergunte');
  await expect(page.getByText('Demonstração', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Entender como funciona' }).click();
  await expect(page.locator('#como-funciona')).toBeInViewport();
  await expect(page.getByText('Os dois recebem', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Uma descoberta anterior não garante disponibilidade atual.'),
  ).toBeVisible();
});
for (const width of widths)
  test(`landing responsiva e navegável: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Perguntar à cidade' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/landing-${width}.png`, fullPage: true });
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  });
test('visitante é redirecionado nos fluxos privados', async ({ page }) => {
  for (const path of [
    '/app',
    '/pedidos/novo',
    '/atividades',
    '/ranking',
    '/perfil',
    '/admin',
    '/onboarding',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/entrar/);
  }
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toBeVisible();
});
test('callback adulterado não autentica nem permite redirecionamento externo', async ({ page }) => {
  await page.goto('/auth/callback?next=https://evil.example');
  await expect(page).toHaveURL(/\/entrar\?motivo=falha/);
});
test('páginas legais e metadata pública', async ({ page, request }) => {
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { name: 'Privacidade', exact: true })).toBeVisible();
  await page.goto('/termos');
  await expect(page.getByRole('heading', { name: 'Termos de uso', exact: true })).toBeVisible();
  const robots = await request.get('/robots.txt');
  expect(await robots.text()).toContain('Disallow: /admin');
  const sitemap = await request.get('/sitemap.xml');
  expect(await sitemap.text()).not.toContain('/app<');
  await page.goto('/');
  expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toMatch(
    /localhost:3100/,
  );
});
test('headers de proteção e CSRF em analytics', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['content-security-policy']).toContain("'nonce-");
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(
    (
      await request.post('/api/analytics', {
        headers: { origin: 'https://evil.example' },
        data: { event: 'CTA_CLICK' },
      })
    ).status(),
  ).toBe(403);
});
test('APIs privadas retornam 401 sem sessão e não executam Places', async ({ request }) => {
  expect(
    (
      await request.get(
        '/api/places?input=Emporio&cityId=3549805&sessionToken=00000000-0000-4000-8000-000000000000',
      )
    ).status(),
  ).toBe(401);
  expect((await request.get('/api/resolved?cityId=3549805&q=farinha')).status()).toBe(401);
});
