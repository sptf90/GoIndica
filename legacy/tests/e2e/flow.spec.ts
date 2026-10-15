import { test, expect, type Page } from '@playwright/test';
import { context } from './helpers';
async function indicate(page: Page, url: string, placeName: string) {
  await page.goto(url);
  await page.getByRole('link', { name: 'Indicar local' }).click();
  await page.getByLabel('Nome do estabelecimento').fill('Empório');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: new RegExp(placeName + ',') }).click();
  await page.getByLabel('Como você sabe?').fill('Comprei neste local recentemente.');
  await page.getByRole('button', { name: 'Confirmar indicação' }).click();
  await expect(page.getByText('Sua indicação foi recebida.', { exact: false })).toBeVisible();
}
test('ciclo completo: OAuth PKCE, onboarding, indicação, cidade, revelação, recompensa, ranking e histórico', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const ana = await context(browser, 'Ana', 'ana_teste');
  const joao = await context(browser, 'João', 'joao_teste');
  const maria = await context(browser, 'Maria', 'maria_teste');
  const carlos = await context(browser, 'Carlos', 'carlos_teste');
  try {
    await ana.page.goto('/pedidos/novo');
    await ana.page.getByLabel('O que você está procurando?').fill('Farinha Caputo para pizza');
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = ana.page.url();
    await expect(ana.page.getByRole('link', { name: 'Indicar local' })).toHaveCount(0);
    await expect(ana.page.getByRole('link', { name: 'Editar pedido' })).toBeVisible();
    await carlos.page.goto(url + '/indicar');
    await carlos.page.getByLabel('Nome do estabelecimento').fill('Empório');
    await carlos.page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await carlos.page.getByRole('button', { name: /Empório fora da cidade,/ }).click();
    await carlos.page.getByRole('button', { name: 'Confirmar indicação' }).click();
    await expect(carlos.page.locator('p[role="alert"]')).toContainText('outra cidade');
    await indicate(joao.page, url, 'Empório A');
    await indicate(maria.page, url, 'Empório A');
    await indicate(carlos.page, url, 'Empório B');
    await joao.page.goto(url + '/indicar');
    await expect(joao.page).toHaveURL(url);
    await expect(joao.page.getByText('Você já indicou um local.', { exact: false })).toBeVisible();
    await ana.page.goto(url);
    await expect(ana.page.locator('.big-count')).toContainText('3');
    await expect(ana.page.getByText('Empório A', { exact: true })).toHaveCount(0);
    await expect(ana.page.getByRole('link', { name: 'Editar pedido' })).toHaveCount(0);
    ana.page.once('dialog', (d) => d.accept());
    await ana.page.getByRole('button', { name: 'Ver indicações' }).click();
    await expect(ana.page.getByRole('heading', { name: 'Empório A', exact: true })).toBeVisible();
    await expect(ana.page.getByText('2 pessoas indicaram', { exact: true })).toBeVisible();
    await expect(ana.page.getByText('1 pessoa indicou', { exact: true })).toBeVisible();
    for (const width of [320, 375, 390, 414, 768, 1024, 1280, 1440]) {
      await ana.page.setViewportSize({ width, height: 850 });
      expect(
        await ana.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true);
      await ana.page.screenshot({ path: `test-results/detail-${width}.png`, fullPage: true });
    }
    await joao.page.goto(url);
    await expect(joao.page.getByText('Empório B', { exact: true })).toHaveCount(0);
    await expect(joao.page.getByRole('link', { name: 'Indicar local' })).toHaveCount(0);
    ana.page.once('dialog', (d) => d.accept());
    await ana.page
      .locator('.indication-group')
      .filter({ has: ana.page.getByRole('heading', { name: 'Empório A', exact: true }) })
      .getByRole('button', { name: 'Encontrei neste local' })
      .click();
    await expect(ana.page.getByRole('heading', { name: 'Encontrado em Empório A' })).toBeVisible();
    await ana.page.reload();
    await expect(ana.page.getByRole('heading', { name: 'Encontrado em Empório A' })).toBeVisible();
    await joao.page.goto('/perfil');
    await expect(joao.page.locator('.profile-stats')).toContainText('10 pontos');
    await maria.page.goto('/perfil');
    await expect(maria.page.locator('.profile-stats')).toContainText('10 pontos');
    await carlos.page.goto('/perfil');
    await expect(carlos.page.locator('.profile-stats')).toContainText('0 pontos');
    await maria.page.goto('/ranking?city=3549805');
    await expect(maria.page.locator('.ranking-list')).toContainText('João');
    await expect(maria.page.locator('.ranking-list')).toContainText('Maria');
    await maria.page.goto('/ranking?city=3530300');
    await expect(maria.page.getByText('Ainda não existem pontos nesta cidade.')).toBeVisible();
    await joao.page.goto('/atividades?tab=confirmed');
    await expect(joao.page.locator('.ledger-row')).toContainText('+10');
    await carlos.page.goto(url);
    await expect(
      carlos.page.getByRole('heading', { name: 'Encontrado em Empório A' }),
    ).toBeVisible();
    await expect(
      carlos.page.getByText('A disponibilidade pode ter mudado.', { exact: false }),
    ).toBeVisible();
    await expect(carlos.page.getByRole('heading', { name: 'Empório B', exact: true })).toHaveCount(
      0,
    );
    await ana.page.goto('/pedidos/novo');
    await ana.page.getByLabel('O que você está procurando?').fill('Farinha Caputo');
    await expect(ana.page.locator('.reuse')).toContainText('Farinha Caputo para pizza');
    await carlos.page.goto('/admin');
    await expect(carlos.page).toHaveURL(/\/app$/);
  } finally {
    await Promise.all([ana.ctx.close(), joao.ctx.close(), maria.ctx.close(), carlos.ctx.close()]);
  }
});
test('admin revisa denúncia, remove conteúdo e bloqueia/desbloqueia com auditoria', async ({
  browser,
}) => {
  const ana = await context(browser, 'Ana', 'ana_teste');
  const carlos = await context(browser, 'Carlos', 'carlos_teste');
  const admin = await context(browser, 'Administrador', 'admin_teste');
  const joao = await context(browser, 'João', 'joao_teste');
  try {
    await ana.page.goto('/pedidos/novo');
    await ana.page
      .getByLabel('O que você está procurando?')
      .fill('Solicitação para revisar na moderação');
    await ana.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await ana.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = ana.page.url();
    await indicate(joao.page, url, 'Empório A');
    await carlos.page.goto(url);
    await carlos.page.getByText('Denunciar este pedido', { exact: true }).click();
    await carlos.page
      .locator('textarea[name="reason"]')
      .fill('Conteúdo de spam para revisão de teste');
    await carlos.page.getByRole('button', { name: 'Enviar denúncia' }).click();
    await expect(carlos.page.getByText('Denúncia registrada para revisão.')).toBeVisible();
    await admin.page.goto('/admin');
    const row = admin.page
      .locator('.admin-row')
      .filter({ hasText: 'Conteúdo de spam para revisão de teste' });
    await expect(row).toBeVisible();
    admin.page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Marcar revisada' }).click();
    await expect(row).toContainText('Revisada');
    admin.page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'Remover conteúdo' }).click();
    await carlos.page.goto(url);
    await expect(
      carlos.page.getByRole('heading', { name: 'Pedido ou página não encontrado.' }),
    ).toBeVisible();
    await admin.page.goto('/admin?tab=users&q=joao_teste');
    admin.page.once('dialog', (d) => d.accept());
    await admin.page.getByRole('button', { name: 'Bloquear', exact: true }).click();
    await expect(
      admin.page.getByRole('button', { name: 'Desbloquear', exact: true }),
    ).toBeVisible();
    await joao.page.goto('/perfil');
    await expect(joao.page).toHaveURL(/motivo=bloqueado/);
    admin.page.once('dialog', (d) => d.accept());
    await admin.page.getByRole('button', { name: 'Desbloquear', exact: true }).click();
    await expect(admin.page.getByRole('button', { name: 'Bloquear', exact: true })).toBeVisible();
    await joao.page.goto('/perfil');
    await expect(joao.page).toHaveURL(/\/perfil$/);
    for (const tab of ['requests', 'indications', 'rewards', 'logs', 'metrics']) {
      await admin.page.goto('/admin?tab=' + tab);
      await expect(
        admin.page.getByRole('heading', { name: 'Administração', exact: true }),
      ).toBeVisible();
      await expect(admin.page.getByText('Não foi possível carregar esta página.')).toHaveCount(0);
    }
    await admin.page.goto('/admin?tab=indications');
    const inspect = admin.page.getByRole('link', { name: 'Inspecionar indicação' }).first();
    await inspect.click();
    await expect(admin.page.getByRole('link', { name: 'Ver no Google Maps' })).toBeVisible();
  } finally {
    await Promise.all([ana.ctx.close(), carlos.ctx.close(), admin.ctx.close(), joao.ctx.close()]);
  }
});
test('telas autenticadas responsivas nos oito tamanhos, sem erros de hidratação', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const ana = await context(browser, 'Ana', 'ana_teste');
  const errors: string[] = [];
  ana.page.on('pageerror', (error) => errors.push(error.message));
  try {
    for (const [name, path] of [
      ['feed', '/app'],
      ['novo', '/pedidos/novo'],
      ['atividades', '/atividades'],
      ['ranking', '/ranking'],
      ['perfil', '/perfil'],
      ['perfil-publico', '/perfil/ana_teste'],
    ]) {
      await ana.page.goto(path);
      await expect(ana.page.getByText('Não foi possível carregar esta página.')).toHaveCount(0);
      for (const width of [320, 375, 390, 414, 768, 1024, 1280, 1440]) {
        await ana.page.setViewportSize({ width, height: 850 });
        expect(
          await ana.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${path}: ${width}px`,
        ).toBe(true);
        await ana.page.screenshot({ path: `test-results/${name}-${width}.png`, fullPage: true });
      }
    }
    expect(errors).toEqual([]);
  } finally {
    await ana.ctx.close();
  }
});
