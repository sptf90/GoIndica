import { expect, type Page, type Browser } from '@playwright/test';
export const password = 'Senha longa de teste 123!';
export async function login(page: Page, name: string, username: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(username + '@test.invalid');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Vamos nos conhecer\?|O que você está procurando\?/,
  );
  if (page.url().includes('/onboarding')) {
    await page.getByLabel('Nome de exibição', { exact: true }).fill(name);
    await page.getByLabel('Nome de usuário', { exact: true }).fill(username);
    await page
      .getByLabel('Cidade', { exact: true })
      .fill(name === 'Maria' ? 'Mirassol' : 'São José do Rio Preto');
    await page
      .getByRole('option', {
        name: name === 'Maria' ? 'Mirassol SP' : 'São José do Rio Preto SP',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: 'Concluir e entrar' }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
}
export async function context(browser: Browser, name: string, username: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await ctx.newPage();
  await login(page, name, username);
  return { ctx, page };
}

// Browser boundary fixture: real Google payloads and validation are covered in unit tests.
// Keep browser journey tests independent of paid external requests.
export async function mockPlaceSuggestions(page: Page) {
  const searches: URL[] = [];
  const selections: { googlePlaceId: string; sessionToken: string }[] = [];
  await page.route('**/api/places?*', async (route) => {
    const url = new URL(route.request().url());
    searches.push(url);
    const input = url.searchParams.get('input') || '';
    if (input === 'Falha') {
      await route.fulfill({
        status: 503,
        json: { error: 'Não foi possível buscar agora. Tente novamente.' },
      });
      return;
    }
    await route.fulfill({
      json:
        input === 'Inexistente'
          ? []
          : [
              { id: 'ChIJ_fixture_A', label: 'Empório A, Rua A, 10, Centro' },
              { id: 'ChIJ_fixture_B', label: 'Empório B, Rua B, 20, Centro' },
            ],
    });
  });
  await page.route('**/api/places', async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    const body = route.request().postDataJSON();
    if (!body.googlePlaceId) return route.continue();
    selections.push(body);
    const letter = body.googlePlaceId.endsWith('_A') ? 'A' : 'B';
    const address = letter === 'A' ? 'Rua A, 10, Centro' : 'Rua B, 20, Centro';
    const response = await page.request.post('/api/places', {
      headers: { origin: new URL(page.url()).origin },
      data: { name: 'Empório ' + letter, address, cityId: 3549805 },
    });
    expect(response.ok()).toBe(true);
    await route.fulfill({ json: { ...(await response.json()), attributions: [] } });
  });
  return { searches, selections };
}
