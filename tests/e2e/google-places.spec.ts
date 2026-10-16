import { test, expect } from './fixtures';
import { context, mockPlaceSuggestions } from './helpers';
test('sugestões automáticas têm debounce, teclado, sessão e mensagens de erro', async ({
  browser,
}, testInfo) => {
  const owner = await context(browser, 'Ana', 'ana_teste');
  const helper = await context(browser, 'João', 'joao_teste');
  try {
    await owner.page.goto('/pedidos/novo');
    await owner.page
      .getByLabel('O que você está procurando?')
      .fill('Peça para testar autocomplete');
    await owner.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await owner.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    await helper.page.goto(owner.page.url() + '/indicar');
    const fixture = await mockPlaceSuggestions(helper.page);
    const input = helper.page.getByRole('combobox', { name: 'Nome do estabelecimento' });
    await expect(helper.page.getByRole('button', { name: 'Buscar', exact: true })).toHaveCount(0);
    await input.fill('Em');
    await helper.page.waitForTimeout(450);
    expect(fixture.searches).toHaveLength(0);
    await input.fill('Emp');
    await input.fill('Empório');
    await expect(helper.page.getByRole('option')).toHaveCount(2);
    expect(fixture.searches).toHaveLength(1);
    const menu = helper.page.locator('.place-suggestions-menu');
    await expect(menu).toHaveCSS('position', 'absolute');
    await expect(helper.page.getByRole('option').first().locator('strong')).toHaveText('Empório A');
    for (const width of [390, 1280]) {
      await helper.page.setViewportSize({ width, height: 900 });
      const fieldBox = (await input.boundingBox())!;
      const menuBox = (await menu.boundingBox())!;
      expect(Math.abs(menuBox.x - fieldBox.x)).toBeLessThan(2);
      expect(Math.abs(menuBox.width - fieldBox.width)).toBeLessThan(2);
      expect(menuBox.y).toBeGreaterThanOrEqual(fieldBox.y + fieldBox.height);
      expect(menuBox.y - fieldBox.y - fieldBox.height).toBeLessThan(12);
      await helper.page.screenshot({
        path: testInfo.outputPath(`dropdown-${width}.png`),
        fullPage: true,
      });
    }

    const firstToken = fixture.searches[0].searchParams.get('sessionToken');
    expect(firstToken).toMatch(/^[a-f0-9-]{36}$/);
    await input.press('Escape');
    await expect(helper.page.getByRole('option')).toHaveCount(0);
    await input.press('ArrowDown');
    await expect(helper.page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
    await input.press('Enter');
    await expect(helper.page.locator('.selected-place')).toContainText('Empório A');
    expect(fixture.selections[0].sessionToken).toBe(firstToken);
    await input.fill('Empório B');
    await expect(helper.page.getByRole('option')).toHaveCount(2);
    expect(fixture.searches.at(-1)?.searchParams.get('sessionToken')).not.toBe(firstToken);
    await expect(helper.page.locator('.selected-place')).toHaveCount(0);
    await input.fill('Inexistente');
    await expect(helper.page.locator('p[role=alert]')).toContainText(
      'Nenhum estabelecimento encontrado',
    );
    await input.fill('Falha');
    await expect(helper.page.locator('p[role=alert]')).toContainText('Não foi possível buscar');
    await expect(helper.page.getByRole('button', { name: 'Confirmar indicação' })).toHaveCount(0);
  } finally {
    await owner.ctx.close();
    await helper.ctx.close();
  }
});
