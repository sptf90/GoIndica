import { test, expect } from '@playwright/test';
import { login } from '../e2e/helpers';
test('login, rascunho, cidade, publicação, privacidade e menu em outro navegador', async ({
  page,
  browserName,
}) => {
  const name = browserName === 'firefox' ? 'NinaFirefox' : 'NinaWebkit';
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, name, browserName + '_teste');
  await page.goto('/pedidos/novo?q=Peça%20para%20café&city=3549805');
  await expect(page.getByLabel('O que você está procurando?')).toHaveValue('Peça para café');
  await page.getByLabel('Bairro ou região').fill('Centro');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Object.keys(localStorage).some((k) => k.startsWith('goindica:request:v1:')),
      ),
    )
    .toBe(true);
  await page.goto('/perfil');
  await page.goto('/pedidos/novo');
  await page.getByRole('button', { name: 'Restaurar rascunho' }).click();
  await expect(page.getByLabel('Bairro ou região')).toHaveValue('Centro');
  await page.getByRole('button', { name: 'Publicar pedido' }).click();
  await page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
  await expect(page.getByRole('button', { name: 'Salvar pedido', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const status = await page.request.get('/api/request-status?id=' + page.url().split('/').pop());
  expect(await status.json()).toEqual({ status: 'OPEN', indication_count: 0 });
  await page.getByRole('button', { name: 'Salvar pedido', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remover dos salvos' })).toBeVisible();
  await page.getByLabel('Menu de navegação').click();
  await page
    .locator('.mobile-nav')
    .getByRole('link', { name: 'Pedidos salvos', exact: true })
    .click();
  await expect(page.locator('.request-list')).toContainText('Peça para café');
  await page.goto('/conta');
  await expect(page.getByRole('link', { name: 'Baixar meus dados' })).toBeVisible();
});
