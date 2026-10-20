import sharp from 'sharp';
import { test, expect } from './fixtures';
import { context } from './helpers';

test('cidade do perfil é o padrão do feed e a escolha manual não muda o perfil', async ({
  browser,
}) => {
  const carla = await context(browser, 'Carla', 'carla_teste');
  const { page } = carla;
  try {
    await page.goto('/perfil');
    await page.locator('.profile-editor > summary').click();
    await page.getByLabel('Cidade', { exact: true }).fill('Mirassol');
    await page.getByRole('option', { name: 'Mirassol SP', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expect(page.locator('.action-form .notice.success')).toContainText('Perfil atualizado.');
    await page.goto('/app');
    const feedCity = page.locator('.city-disclosure > summary');
    await expect(feedCity).toContainText('Mirassol — SP');
    await feedCity.click();
    await page.locator('.city-disclosure').getByRole('combobox').fill('São José do Rio Preto');
    await page.getByRole('option', { name: 'São José do Rio Preto SP', exact: true }).click();
    await page.locator('.city-disclosure-content').getByRole('button').click();
    await expect(page).toHaveURL(/city=3549805/);
    await expect(feedCity).toContainText('São José do Rio Preto — SP');
    await page.goto('/perfil');
    await expect(page.locator('.profile-city')).toContainText('Mirassol — SP');
    await page.goto('/app');
    await expect(feedCity).toContainText('Mirassol — SP');
  } finally {
    await page.goto('/perfil');
    await page.locator('.profile-editor > summary').click();
    await page.getByLabel('Cidade', { exact: true }).fill('São José do Rio Preto');
    await page.getByRole('option', { name: 'São José do Rio Preto SP', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expect(page.locator('.action-form .notice.success')).toContainText('Perfil atualizado.');
    await carla.ctx.close();
  }
});

test('perfil alheio só abre a partir do pedido, com foto, e nome em uso é avisado', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const author = await context(browser, 'Ana', 'ana_teste');
  const reader = await context(browser, 'Carla', 'carla_teste');
  try {
    await author.page.goto('/perfil');
    await author.page.locator('.profile-editor > summary').click();
    const photo = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#ec5e27' },
    })
      .png()
      .toBuffer();
    await author.page
      .getByLabel('Foto de perfil')
      .setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: photo });
    await expect(author.page.getByAltText('Prévia da foto de perfil')).toBeVisible();
    await author.page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expect(author.page.locator('.action-form .notice.success')).toContainText(
      'Perfil atualizado.',
    );
    await author.page.goto('/pedidos/novo');
    await author.page.getByLabel('O que você está procurando?').fill('Fita isolante colorida');
    await author.page.getByRole('button', { name: 'Publicar pedido', exact: true }).click();
    await author.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const requestPath = new URL(author.page.url()).pathname;

    await reader.page.goto('/perfil/ana_teste');
    await expect(reader.page.getByRole('heading', { level: 1 })).toHaveText(
      'Pedido ou página não encontrado.',
    );
    await expect(reader.page.getByText('@ana_teste')).toHaveCount(0);

    await reader.page.goto(requestPath);
    const byline = reader.page.locator('a.byline');
    await expect(byline).toContainText('@ana_teste');
    const avatar = byline.locator('img.avatar');
    await expect(avatar).toHaveAttribute('src', /\/api\/profile-photo\?pedido=/);
    const image = await reader.page.request.get((await avatar.getAttribute('src'))!);
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toBe('image/jpeg');
    const unscoped = new URL((await avatar.getAttribute('src'))!, reader.page.url());
    unscoped.searchParams.delete('pedido');
    expect((await reader.page.request.get(unscoped.toString())).status()).toBe(404);

    await byline.click();
    await expect(reader.page).toHaveURL(/\/perfil\/ana_teste\?pedido=/);
    await expect(reader.page.getByRole('heading', { level: 1 })).toHaveText('Ana');
    await expect(reader.page.locator('.profile-heading')).toContainText('@ana_teste');
    await expect(reader.page.locator('.recognition')).toBeVisible();
    await expect(reader.page.locator('.profile-stats')).toHaveCount(0);

    await reader.page.goto('/perfil');
    await reader.page.locator('.profile-editor > summary').click();
    await reader.page.getByLabel('Nome de usuário', { exact: true }).fill('ana_teste');
    await expect(
      reader.page.getByText('Este nome de usuário já está em uso. Escolha outro.'),
    ).toBeVisible();
    await reader.page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await reader.page.goto('/perfil');
    await expect(reader.page.locator('.profile-heading')).toContainText('@carla_teste');
  } finally {
    await Promise.all([author.ctx.close(), reader.ctx.close()]);
  }
});
