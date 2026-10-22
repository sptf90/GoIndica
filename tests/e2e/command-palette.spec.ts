import { test, expect } from './fixtures';
import { context } from './helpers';

test('paleta de comandos abre com o atalho e leva a busca para um novo pedido', async ({
  browser,
}) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  try {
    const { page } = ana;
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/app');
    const palette = page.getByRole('dialog', { name: 'Buscar e navegar' });
    await expect(async () => {
      await page.keyboard.press('Control+k');
      await expect(palette).toBeVisible({ timeout: 1000 });
    }).toPass();
    await expect(palette.getByRole('combobox')).toBeFocused();
    await palette.getByRole('combobox').fill('farinha');
    await expect(
      palette.getByRole('option', { name: 'Perguntar à cidade: “farinha”' }),
    ).toBeVisible();
    await page.screenshot({ path: 'test-results/command-palette-1280.png' });
    await page.keyboard.press('Escape');
    await expect(palette).toBeHidden();

    await page.getByRole('button', { name: 'Buscar e navegar' }).click();
    await page.getByRole('combobox').fill('farinha');
    await page.getByRole('option', { name: 'Perguntar à cidade: “farinha”' }).click();
    await page.waitForURL(/\/pedidos\/novo\?q=farinha$/);
    await expect(page.getByLabel('O que você está procurando?')).toHaveValue('farinha');
  } finally {
    await ana.ctx.close();
  }
});
