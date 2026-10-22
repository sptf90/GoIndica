import { test, expect } from './fixtures';
const widths = [320, 375, 390, 430, 768, 1024, 1200, 1280, 1440];
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
test('páginas públicas mantêm reflow com texto a 200% em 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 600 });
  for (const route of ['/', '/entrar', '/cadastro', '/cadastro?tipo=empresa', '/recuperar-senha', '/privacidade', '/termos']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate(() => {
      const sizes = [...document.querySelectorAll<HTMLElement>('body *')].map((el) => [el, getComputedStyle(el).fontSize] as const);
      sizes.forEach(([el, size]) => { el.style.fontSize = `${parseFloat(size) * 2}px`; });
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).not.toBeInViewport();
    for (const label of await page.locator('.ranking-preview .ranking-row > div').all()) {
      expect(await label.evaluate((el) => {
        const text = el.querySelector('.hint')!;
        const canvas = document.createElement('canvas').getContext('2d')!;
        canvas.font = getComputedStyle(text).font;
        return el.getBoundingClientRect().width >= canvas.measureText('comunidade').width;
      })).toBe(true);
    }
    const footer = page.getByRole('contentinfo');
    await footer.scrollIntoViewIfNeeded();
    await expect(footer.getByRole('link', { name: 'Termos de uso' })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `test-results/publico-texto-200-${route.replaceAll('/', '-').replaceAll('?', '-')}.png`, fullPage: true });
  }
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
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toHaveCount(0);
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
