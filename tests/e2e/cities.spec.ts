import { test, expect } from './fixtures';
import type { City } from '../../src/lib/types';
import { login } from './helpers';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];

test('API nacional: acentos, partes do nome, UF e municípios de todas as regiões', async ({
  request,
}) => {
  for (const [name, state] of [
    ['Manaus', 'AM'],
    ['Belém', 'PA'],
    ['Salvador', 'BA'],
    ['Recife', 'PE'],
    ['Brasília', 'DF'],
    ['Cuiabá', 'MT'],
    ['São Paulo', 'SP'],
    ['Vitória', 'ES'],
    ['Curitiba', 'PR'],
    ['Porto Alegre', 'RS'],
  ]) {
    const response = await request.get('/api/cities?q=' + encodeURIComponent(`${name} ${state}`));
    expect(response.ok()).toBe(true);
    const cities = (await response.json()) as City[];
    expect(cities.some((city) => city.name === name && city.state_code === state)).toBe(true);
    expect(cities.every((city) => city.country_code === 'BR' && city.state_code === state)).toBe(
      true,
    );
  }
  const partial = await request.get('/api/cities?q=Rio%20Preto%20SP');
  expect(
    ((await partial.json()) as City[]).some((city) => city.name === 'São José do Rio Preto'),
  ).toBe(true);
  for (const state of ['RS', 'RN']) {
    const response = await request.get('/api/cities?q=Bom%20Jesus%20' + state);
    expect(
      ((await response.json()) as City[]).some(
        (city) => city.name === 'Bom Jesus' && city.state_code === state,
      ),
    ).toBe(true);
  }
  expect(await (await request.get('/api/cities?q=%25_')).json()).toEqual([]);
});

test('sugestões automáticas, teclado e seleção obrigatória sem botão de busca de cidade', async ({
  page,
}) => {
  await login(page, 'Ana', 'ana_teste');
  await page.goto('/pedidos/novo');
  const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
  await expect(page.getByRole('button', { name: 'Buscar', exact: true })).toHaveCount(0);
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/cities?')) requests.push(request.url());
  });
  await city.fill('M');
  await city.fill('Ma');
  await city.fill('Manaus AM');
  const option = page.getByRole('option', { name: 'Manaus AM', exact: true });
  await expect(option).toBeVisible();
  expect(requests).toHaveLength(1);
  await expect(city).toBeFocused();
  await expect(page.locator('input[name="cityId"]')).toHaveValue('');
  await page.getByLabel('O que você está procurando?').fill('Produto para pesquisar no Brasil');
  await page.getByRole('button', { name: 'Publicar pedido' }).click();
  await expect(page).toHaveURL(/\/pedidos\/novo$/);
  await expect(city).toBeFocused();
  await city.press('ArrowDown');
  await expect(option).toHaveAttribute('aria-selected', 'true');
  await expect(city).toHaveAttribute(
    'aria-activedescendant',
    (await option.getAttribute('id')) as string,
  );
  await city.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(city).toBeFocused();
  await city.press('ArrowUp');
  await expect(option).toBeVisible();
  await city.press('Enter');
  await expect(city).toHaveValue('Manaus — AM');
  await expect(page.locator('input[name="cityId"]')).toHaveValue('1302603');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(page).toHaveURL(/\/pedidos\/novo$/);
  await city.fill('Município inexistente xyz');
  await expect(page.locator('input[name="cityId"]')).toHaveValue('');
  await expect(page.locator('.city-selector')).toContainText('Nenhuma cidade encontrada');
  await city.fill('Bom Jesus RS');
  await expect(page.getByRole('option', { name: 'Bom Jesus RS', exact: true })).toBeVisible();
  await city.press('Tab');
  await expect(page.getByRole('listbox')).toHaveCount(0);
});

test('falha de rede informa o problema e permite tentar novamente sem apagar a pesquisa', async ({
  page,
}) => {
  await login(page, 'Ana', 'ana_teste');
  await page.goto('/perfil');
  await page.locator('.profile-editor > summary').click();
  let fail = true;
  await page.route('**/api/cities?**', async (route) => {
    if (fail) await route.fulfill({ status: 503, json: { error: 'indisponível' } });
    else await route.continue();
  });
  const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
  await city.fill('Salvador BA');
  await expect(page.locator('.city-selector')).toContainText(
    'Não foi possível carregar as cidades',
  );
  await expect(city).toHaveValue('Salvador BA');
  fail = false;
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.getByRole('option', { name: 'Salvador BA', exact: true })).toBeVisible();
  await page.getByRole('option', { name: 'Salvador BA', exact: true }).click();
  await expect(city).toHaveValue('Salvador — BA');
});

test('resposta atrasada não substitui as sugestões de uma pesquisa mais recente', async ({
  page,
}) => {
  await login(page, 'Ana', 'ana_teste');
  await page.goto('/app');
  await page.locator('.city-disclosure > summary').click();
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const received = new Promise<void>((resolve) => {
    started = resolve;
  });
  let finished!: () => void;
  const completed = new Promise<void>((resolve) => {
    finished = resolve;
  });
  await page.route('**/api/cities?**', async (route) => {
    if (new URL(route.request().url()).searchParams.get('q') !== 'Rio') return route.continue();
    const response = await route.fetch();
    started();
    await blocked;
    try {
      await route.fulfill({ response });
    } finally {
      finished();
    }
  });
  const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
  await city.fill('Rio');
  await received;
  await city.fill('Manaus AM');
  await expect(page.getByRole('option', { name: 'Manaus AM', exact: true })).toBeVisible();
  release();
  await completed;
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option', { name: 'Manaus AM', exact: true })).toBeVisible();
});

test('filtros alinhados e sugestões sem deslocar o formulário nos oito tamanhos', async ({
  page,
}) => {
  test.setTimeout(120000);
  await login(page, 'Ana', 'ana_teste');
  for (const width of widths) {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/app');
    await page.locator('.city-disclosure > summary').click();
    const text = page.getByLabel('Buscar pedidos');
    const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
    const submit = page
      .locator('.city-disclosure-content')
      .getByRole('button', { name: 'Buscar na cidade', exact: true });
    await expect(text).toBeVisible();
    await expect(city).toBeVisible();
    await expect(submit).toBeVisible();
    const a = (await text.boundingBox())!;
    const b = (await city.boundingBox())!;
    const c = (await submit.boundingBox())!;
    expect(a.height).toBeGreaterThanOrEqual(44);
    expect(Math.abs(b.height - c.height)).toBeLessThanOrEqual(1);
    expect(b.y).toBeGreaterThan(a.y + a.height);
    if (width >= 768) expect(Math.abs(b.y - c.y)).toBeLessThanOrEqual(1);
    if (width < 768) {
      expect(b.y).toBeGreaterThan(a.y + a.height);
      expect(c.width).toBeLessThanOrEqual(b.width);
    }
    await page.screenshot({ path: `test-results/feed-aligned-${width}.png`, fullPage: true });
    await city.fill('Bom Jesus');
    await expect(page.getByRole('listbox')).toBeVisible();
    const list = (await page.getByRole('listbox').boundingBox())!;
    expect(list.y).toBeGreaterThanOrEqual(0);
    // Navigation now opens beneath the header; no fixed footer covers the list.
    expect(list.y + list.height).toBeLessThanOrEqual(850);
    const after = (await text.boundingBox())!;
    expect(after.y).toEqual(a.y);
    expect(after.height).toEqual(a.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/city-suggestions-${width}.png`, fullPage: true });
    await page.goto('/ranking');
    await expect(page.getByRole('combobox', { name: 'Cidade', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver ranking', exact: true })).toBeVisible();
    const rcity = (await page
      .getByRole('combobox', { name: 'Cidade', exact: true })
      .boundingBox())!;
    const rbutton = (await page
      .getByRole('button', { name: 'Ver ranking', exact: true })
      .boundingBox())!;
    expect(Math.abs(rcity.height - rbutton.height)).toBeLessThanOrEqual(1);
    if (width >= 768) expect(Math.abs(rcity.y - rbutton.y)).toBeLessThanOrEqual(1);
    else expect(rbutton.width).toBeLessThanOrEqual(rcity.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

test('seleção por toque funciona no formulário de celular', async ({ browser }) => {
  const mobile = await browser.newContext({
    viewport: { width: 375, height: 812 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await mobile.newPage();
    await login(page, 'Ana', 'ana_teste');
    await page.goto('/app');
    await page.locator('.city-disclosure > summary').click();
    const city = page.getByRole('combobox', { name: 'Cidade', exact: true });
    await city.tap();
    await city.fill('Recife PE');
    await page.getByRole('option', { name: 'Recife PE', exact: true }).tap();
    await expect(city).toHaveValue('Recife — PE');
    await expect(page.locator('input[name="city"]')).toHaveValue('2611606');
    await page
      .locator('.city-disclosure-content')
      .getByRole('button', { name: 'Buscar na cidade', exact: true })
      .tap();
    await page.locator('.city-disclosure > summary').click();
    await expect(page).toHaveURL(/city=2611606/);
    await expect(page.getByRole('combobox', { name: 'Cidade', exact: true })).toHaveValue(
      'Recife — PE',
    );
  } finally {
    await mobile.close();
  }
});
