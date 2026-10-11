import { test, expect } from '@playwright/test';
import { access } from 'node:fs/promises';
const required = [
  'E2E_CITY_ID',
  'E2E_PLACE_QUERY',
  'E2E_PLACE_ID',
  'E2E_HELPER_A_USERNAME',
  'E2E_HELPER_B_USERNAME',
];
test('provedores reais: duas indicações do mesmo local e +10 para ambas', async ({ browser }) => {
  for (const name of required) if (!process.env[name]) throw new Error('Defina ' + name);
  const files = ['owner', 'helper-a', 'helper-b'].map((name) => 'tests/.auth/' + name + '.json');
  for (const file of files) await access(file);
  const contexts = await Promise.all(
    files.map((storageState) =>
      browser.newContext({
        storageState,
        baseURL: process.env.E2E_BASE_URL,
        viewport: { width: 390, height: 844 },
      }),
    ),
  );
  const [owner, a, b] = await Promise.all(contexts.map((c) => c.newPage()));
  try {
    const city = process.env.E2E_CITY_ID!;
    const selected = process.env.E2E_PLACE_ID!;
    const before: number[] = [];
    for (const p of [a, b]) {
      await p.goto('/perfil');
      await expect(p).toHaveURL(/\/perfil$/);
      before.push(
        Number(
          await p
            .locator('.profile-stats p')
            .filter({ hasText: 'pontos' })
            .locator('strong')
            .textContent(),
        ),
      );
    }
    await owner.goto('/pedidos/novo?city=' + encodeURIComponent(city));
    await expect(owner.locator('input[name="cityId"]')).toHaveValue(city);
    await owner
      .getByLabel('O que você está procurando?')
      .fill('Homologação: descoberta em estabelecimento real — ' + Date.now());
    await owner.getByRole('button', { name: 'Publicar pedido' }).click();
    await owner.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = owner.url();
    for (const p of [a, b]) {
      await p.goto(url);
      await p.getByRole('link', { name: 'Indicar local' }).click();
      await p.getByLabel('Nome do estabelecimento').fill(process.env.E2E_PLACE_QUERY!);
      await p.getByRole('button', { name: 'Buscar', exact: true }).click();
      await p.locator(`button[data-place-id="${selected}"]`).click();
      await p.getByRole('button', { name: 'Confirmar indicação' }).click();
      await expect(p.getByText('Sua indicação foi recebida.', { exact: false })).toBeVisible();
    }
    await owner.goto(url);
    await expect(owner.locator('.big-count')).toContainText('2');
    owner.once('dialog', (d) => d.accept());
    await owner.getByRole('button', { name: 'Ver indicações' }).click();
    await expect(owner.getByText('2 pessoas indicaram', { exact: true })).toBeVisible();
    owner.once('dialog', (d) => d.accept());
    await owner.getByRole('button', { name: 'Encontrei neste local' }).click();
    await expect(owner.getByRole('heading', { name: /Encontrado em/ })).toBeVisible();
    await owner.reload();
    for (const [index, p] of [a, b].entries()) {
      await p.goto('/perfil');
      await expect(
        p.locator('.profile-stats p').filter({ hasText: 'pontos' }).locator('strong'),
      ).toHaveText(String(before[index] + 10));
      await p.reload();
      await expect(
        p.locator('.profile-stats p').filter({ hasText: 'pontos' }).locator('strong'),
      ).toHaveText(String(before[index] + 10));
    }
    await a.goto('/ranking?city=' + city);
    await expect(a.locator('.ranking-list')).toContainText('@' + process.env.E2E_HELPER_A_USERNAME);
    await expect(a.locator('.ranking-list')).toContainText('@' + process.env.E2E_HELPER_B_USERNAME);
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
});
