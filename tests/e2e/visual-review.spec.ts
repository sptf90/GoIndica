import { test, expect } from './fixtures';
import type { Page } from '@playwright/test';
import { context, mockPlaceSuggestions } from './helpers';

const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440];
async function inspect(page: Page, name: string) {
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  for (const width of widths) {
    await page.setViewportSize({ width, height: 850 });
    const stats = page.locator('.profile-stats > p');
    if (width >= 375 && (await stats.count()) === 2) {
      const points = (await stats.nth(0).boundingBox())!;
      const confirmations = (await stats.nth(1).boundingBox())!;
      expect(
        Math.abs(points.y - confirmations.y),
        `Estatísticas do perfil: ${width}px`,
      ).toBeLessThanOrEqual(1);
    }
    for (const tab of await page.locator('.tabs a[aria-current="page"]').all()) {
      await expect(tab).toBeInViewport({ ratio: 1 });
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      `${name}: ${width}px`,
    ).toBe(true);
    await page.screenshot({ path: `test-results/${name}-${width}.png`, fullPage: true });
  }
}

test('admin, edição e indicação permanecem legíveis em celular e desktop', async ({ browser }) => {
  test.setTimeout(120000);
  const ana = await context(browser, 'Ana', 'ana_teste');
  const joao = await context(browser, 'João', 'joao_teste');
  const admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    await ana.page.goto('/pedidos/novo');
    await ana.page
      .getByLabel('O que você está procurando?')
      .fill('Pesquisa com texto longo para revisão ' + 'x'.repeat(150));
    await ana.page.getByLabel('Bairro ou região').fill('y'.repeat(100));
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = ana.page.url();
    await inspect(ana.page, 'pedido-aberto-texto-longo');
    await ana.page.getByRole('link', { name: 'Editar pedido', exact: true }).click();
    await inspect(ana.page, 'editar-pedido');
    await joao.page.goto(url + '/indicar');
    await inspect(joao.page, 'indicar-local');
    await mockPlaceSuggestions(joao.page);
    await joao.page.getByLabel('Nome do estabelecimento').fill('Empório');
    await joao.page.getByRole('option', { name: /Empório A,/ }).click();
    await inspect(joao.page, 'local-selecionado');
    await joao.page.getByLabel('Como você sabe?').fill('z'.repeat(300));
    await joao.page.getByRole('button', { name: 'Confirmar indicação' }).click();
    await expect(
      joao.page.getByText('Sua indicação foi recebida.', { exact: false }),
    ).toBeVisible();
    await ana.page.goto(url);
    ana.page.once('dialog', (dialog) => dialog.accept());
    await ana.page.getByRole('button', { name: 'Ver indicações' }).click();
    await expect(ana.page.getByRole('heading', { name: 'Empório A', exact: true })).toBeVisible();
    await inspect(ana.page, 'indicacao-comentario-longo');
    ana.page.once('dialog', (dialog) => dialog.accept());
    await ana.page.getByRole('button', { name: 'Encontrei neste local', exact: true }).click();
    await expect(ana.page.getByRole('heading', { name: 'Encontrado em Empório A' })).toBeVisible();
    for (const tab of [
      'reports',
      'users',
      'requests',
      'indications',
      'rewards',
      'logs',
      'metrics',
    ]) {
      await admin.page.goto('/admin?tab=' + tab);
      await expect(
        admin.page.getByRole('heading', { name: 'Administração', exact: true }),
      ).toBeVisible();
      await inspect(admin.page, 'admin-' + tab);
      if (['users', 'requests', 'indications'].includes(tab)) {
        const input = (await admin.page.getByLabel('Pesquisar', { exact: true }).boundingBox())!;
        const submit = (await admin.page
          .getByRole('button', { name: 'Buscar', exact: true })
          .boundingBox())!;
        expect(Math.abs(input.y - submit.y)).toBeLessThanOrEqual(1);
        expect(Math.abs(input.height - submit.height)).toBeLessThanOrEqual(1);
      }
    }
  } finally {
    await Promise.all([ana.ctx.close(), joao.ctx.close(), admin.ctx.close()]);
  }
});

test('nome longo não quebra cabeçalho, perfil, ranking ou histórico de recompensas', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const joao = await context(browser, 'João', 'joao_teste');
  const longName = 'Pessoa' + 'x'.repeat(54);
  try {
    await joao.page.goto('/perfil');
    await joao.page.locator('.profile-editor > summary').click();
    await joao.page.getByLabel('Nome de exibição', { exact: true }).fill(longName);
    await joao.page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expect(joao.page.locator('.action-form .notice.success')).toContainText(
      'Perfil atualizado.',
    );
    await expect(joao.page).toHaveURL(/\/perfil$/);
    await expect(joao.page.getByRole('heading', { name: longName, exact: true })).toBeVisible();
    for (const [name, path] of [
      ['perfil-nome-longo', '/perfil'],
      ['publico-nome-longo', '/perfil/joao_teste'],
      ['ranking-nome-longo', '/ranking'],
      ['historico-nome-longo', '/atividades?tab=confirmed'],
    ]) {
      await joao.page.goto(path);
      await inspect(joao.page, name);
    }
  } finally {
    await joao.page.goto('/perfil');
    await joao.page.locator('.profile-editor > summary').click();
    await joao.page.getByLabel('Nome de exibição', { exact: true }).fill('João');
    await joao.page.getByRole('button', { name: 'Salvar perfil', exact: true }).click();
    await expect(joao.page.getByRole('heading', { name: 'João', exact: true })).toBeVisible();
    await joao.ctx.close();
  }
});

test('páginas legais e página ausente se adaptam aos oito tamanhos', async ({ page }) => {
  for (const [name, path] of [
    ['privacidade', '/privacidade'],
    ['termos', '/termos'],
    ['pagina-ausente', '/endereco-inexistente'],
  ]) {
    await page.goto(path);
    await inspect(page, name);
  }
});
