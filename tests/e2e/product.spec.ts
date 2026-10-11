import { test, expect } from '@playwright/test';
import { context } from './helpers';
import { randomUUID } from 'node:crypto';
test('busca, rascunho, publicação, favoritos, cidades, indicação e notificações', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const owner = await context(browser, 'Sofia', 'sofia_teste'),
    helper = await context(browser, 'Bruno', 'bruno_teste');
  try {
    await owner.page.goto('/app?q=Peça%20de%20café&city=3549805');
    await owner.page.getByRole('link', { name: 'Publicar esta busca' }).click();
    await expect(owner.page.getByLabel('O que você está procurando?')).toHaveValue('Peça de café');
    await owner.page.getByLabel('Bairro ou região').fill('Centro');
    await expect
      .poll(() =>
        owner.page.evaluate(() =>
          Object.entries(localStorage).some(
            ([key, value]) => key.startsWith('goindica:request:v1:') && value.includes('Centro'),
          ),
        ),
      )
      .toBe(true);
    await owner.page.goto('/perfil');
    await owner.page.goto('/pedidos/novo');
    await owner.page.getByRole('button', { name: 'Restaurar rascunho' }).click();
    await expect(owner.page.getByLabel('O que você está procurando?')).toHaveValue('Peça de café');
    await expect(owner.page.getByLabel('Bairro ou região')).toHaveValue('Centro');
    await owner.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await owner.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = owner.page.url();
    await expect
      .poll(() =>
        owner.page.evaluate(
          () =>
            Object.keys(localStorage).filter((key) => key.startsWith('goindica:request:v1:'))
              .length,
        ),
      )
      .toBe(0);
    await owner.page.getByRole('button', { name: 'Salvar pedido', exact: true }).click();
    await expect(owner.page.getByRole('button', { name: 'Remover dos salvos' })).toBeVisible();
    await owner.page.goto('/salvos');
    await expect(owner.page.locator('.request-list')).toContainText('Peça de café');
    await owner.page.goto('/preferencias');
    await expect(owner.page.getByRole('checkbox')).not.toBeChecked();
    await owner.page.getByRole('checkbox').check();
    await owner.page.getByRole('button', { name: 'Salvar preferências' }).click();
    await expect(owner.page.getByText('Preferências salvas.', { exact: true })).toBeVisible();
    await owner.page.reload();
    await expect(owner.page.getByRole('checkbox')).toBeChecked();
    await owner.page.getByRole('checkbox').uncheck();
    await owner.page.getByRole('button', { name: 'Salvar preferências' }).click();
    await owner.page
      .locator('form')
      .filter({ has: owner.page.getByRole('button', { name: 'Acompanhar cidade', exact: true }) })
      .getByRole('combobox')
      .fill('Mirassol');
    await owner.page.getByRole('option', { name: 'Mirassol SP', exact: true }).click();
    await owner.page.getByRole('button', { name: 'Acompanhar cidade' }).click();
    await expect(owner.page.getByRole('link', { name: 'Mirassol — SP' })).toBeVisible();
    await owner.page.goto('/app');
    await expect(
      owner.page.getByRole('navigation', { name: 'Cidades acompanhadas' }),
    ).toContainText('Mirassol');
    await owner.page.clock.install();
    await owner.page.goto(url);
    await helper.page.goto(url);
    await helper.page.getByRole('button', { name: 'Acompanhar pedido', exact: true }).click();
    await helper.page.getByRole('link', { name: 'Indicar local' }).click();
    await helper.page.getByLabel('Nome do estabelecimento').fill('Empório');
    await helper.page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await helper.page.getByRole('button', { name: /Empório A,/ }).click();
    await helper.page.getByRole('button', { name: 'Confirmar indicação' }).click();
    await expect(
      helper.page.getByText('Sua indicação foi recebida.', { exact: false }),
    ).toBeVisible();
    await owner.page.clock.fastForward(31000);
    await expect(owner.page.locator('.big-count')).toContainText('1');
    const status = await owner.page.request.get('/api/request-status?id=' + url.split('/').pop());
    expect(await status.json()).toEqual({ status: 'OPEN', indication_count: 1 });
    await expect(owner.page.getByRole('heading', { name: 'Empório A', exact: true })).toHaveCount(
      0,
    );
    await owner.page.goto('/notificacoes');
    await expect(owner.page.getByText('Uma nova indicação chegou', { exact: true })).toBeVisible();
    await expect(owner.page.getByText('Empório A', { exact: true })).toHaveCount(0);
    await owner.page.getByRole('button', { name: 'Marcar todas como lidas' }).click();
    await expect(owner.page.locator('.unread-dot')).toHaveCount(0);
    await owner.page.goto('/pedidos/novo');
    await owner.page
      .getByLabel('O que você está procurando?')
      .fill('Rascunho que deve ser apagado');
    await expect
      .poll(() =>
        owner.page.evaluate(() =>
          Object.keys(localStorage).some((key) => key.startsWith('goindica:request:v1:')),
        ),
      )
      .toBe(true);
    await owner.page.goto('/perfil');
    await owner.page.goto('/pedidos/novo');
    await owner.page.getByRole('button', { name: 'Apagar rascunho', exact: true }).click();
    await expect(owner.page.getByLabel('O que você está procurando?')).toHaveValue('');
  } finally {
    await owner.ctx.close();
    await helper.ctx.close();
  }
});
test('novas páginas não transbordam e exportação isola os dados da conta', async ({ browser }) => {
  const user = await context(browser, 'Sofia', 'sofia_teste');
  try {
    for (const path of ['/notificacoes', '/salvos', '/preferencias', '/conta']) {
      await user.page.goto(path);
      await expect(user.page.getByText('Não foi possível carregar esta página.')).toHaveCount(0);
      for (const width of [320, 390, 768, 1440]) {
        await user.page.setViewportSize({ width, height: 844 });
        expect(
          await user.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path + ' ' + width,
        ).toBe(true);
        await user.page.screenshot({
          path: 'test-results/product-' + path.slice(1) + '-' + width + '.png',
          fullPage: true,
        });
      }
    }
    const response = await user.page.request.get('/api/account/export');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-disposition']).toContain('attachment');
    const exported = await response.json();
    expect(exported.data.profile.username).toBe('sofia_teste');
    expect(
      exported.data.requests.every(
        (r: { requester_id: string }) => r.requester_id === exported.data.profile.id,
      ),
    ).toBe(true);
  } finally {
    await user.ctx.close();
  }
});
test('conta solicita encerramento; administração conclui e bloqueia novo acesso', async ({
  browser,
}) => {
  const user = await context(browser, 'Lia', 'lia_teste'),
    admin = await context(browser, 'Administrador', 'admin_teste');
  try {
    await user.page.goto('/conta');
    const form = user.page
      .locator('form')
      .filter({ has: user.page.getByRole('button', { name: 'Solicitar encerramento' }) });
    await form
      .getByLabel('Motivo ou instruções')
      .fill('Encerrar esta conta de teste após a revisão');
    user.page.once('dialog', (d) => d.accept());
    await form.getByRole('button', { name: 'Solicitar encerramento' }).click();
    await expect(user.page.getByText('Solicitação enviada.', { exact: false })).toBeVisible();
    await admin.page.goto('/admin?tab=support');
    const row = admin.page
      .locator('.admin-row')
      .filter({ hasText: 'Encerrar esta conta de teste após a revisão' });
    const close = row
      .locator('form')
      .filter({ has: admin.page.getByRole('button', { name: 'Encerrar e anonimizar' }) });
    await close
      .getByLabel('Motivo da decisão')
      .fill('Solicitação revisada e encerramento autorizado pelo titular');
    admin.page.once('dialog', (d) => d.accept());
    await close.getByRole('button', { name: 'Encerrar e anonimizar' }).click();
    await expect(
      admin.page
        .locator('.admin-row')
        .filter({ hasText: 'Solicitação revisada e encerramento autorizado pelo titular' }),
    ).toContainText('COMPLETED');
    await user.page.goto('/perfil');
    await expect(user.page).toHaveURL(/motivo=bloqueado/);
    for (const tab of ['operations', 'metrics']) {
      await admin.page.goto('/admin?tab=' + tab);
      await expect(admin.page.getByText('Não foi possível carregar esta página.')).toHaveCount(0);
    }
  } finally {
    await user.ctx.close();
    await admin.ctx.close();
  }
});
test('retorna ao pedido compartilhado após Google e onboarding; grupos paginam separadamente sem consultas extras', async ({
  browser,
}) => {
  test.setTimeout(120000);
  const owner = await context(browser, 'Sofia', 'sofia_teste');
  const guest = await browser.newContext();
  const page = await guest.newPage();
  try {
    const token = await owner.page.evaluate(() => document.cookie);
    expect(token).not.toContain('access_token');
    // Fixture-only scenario preparation uses the server session cookie via the app's
    // authorization bearer extracted from its HttpOnly cookie in test code.
    const cookies = await owner.ctx.cookies();
    const authCookie = cookies
      .filter((c) => c.name.includes('auth-token') && !c.name.includes('code-verifier'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((c) => c.value)
      .join('');
    const auth = JSON.parse(
      Buffer.from(authCookie.replace(/^base64-/, ''), 'base64url').toString(),
    );
    const scenario = await owner.page.request.post('http://localhost:3456/test-scenario', {
      headers: { Authorization: 'Bearer ' + auth.access_token },
    });
    expect(scenario.status()).toBe(200);
    const { id } = await scenario.json();
    const url = '/pedidos/' + id;
    await page.goto(url);
    await expect(page).toHaveURL(/\/entrar\?next=/);
    await page.getByRole('button', { name: 'Continuar com Google' }).click();
    await page.getByRole('link', { name: 'Carlos', exact: true }).click();
    await page.waitForURL(/\/(onboarding|pedidos)/);
    if (page.url().includes('/onboarding')) {
      await page.getByLabel('Nome de exibição', { exact: true }).fill('Carlos');
      await page.getByLabel('Nome de usuário', { exact: true }).fill('carlos_teste');
      await page.getByRole('combobox').fill('São José do Rio Preto');
      await page.getByRole('option', { name: 'São José do Rio Preto SP', exact: true }).click();
      await page.getByRole('button', { name: 'Concluir e entrar' }).click();
    }
    await expect(page).toHaveURL(new RegExp('/pedidos/' + id + '$'));
    const details: string[] = [];
    owner.page.on('request', (r) => {
      if (r.url().includes('/api/place-details')) details.push(r.url());
    });
    await owner.page.goto(url);
    owner.page.once('dialog', (d) => d.accept());
    await owner.page.getByRole('button', { name: 'Ver indicações' }).click();
    await expect(owner.page.getByRole('heading', { name: 'Empório A', exact: true })).toBeVisible();
    expect(details).toHaveLength(1);
    const groups = owner.page.locator('.indication-group');
    await expect(groups.nth(1)).toContainText('Participante do segundo local');
    await groups
      .nth(0)
      .getByRole('link', { name: /Próxima/ })
      .click();
    await expect(groups.nth(0).locator('.indicators li')).toHaveCount(5);
    await expect(groups.nth(1)).toContainText('Participante do segundo local');
    expect(details).toHaveLength(1);
    await groups.nth(1).getByRole('button', { name: 'Ver estabelecimento' }).click();
    await expect(
      groups.nth(1).getByRole('heading', { name: 'Empório B', exact: true }),
    ).toBeVisible();
    expect(details).toHaveLength(2);
    owner.page.once('dialog', (d) => d.accept());
    await groups.nth(0).getByRole('button', { name: 'Encontrei neste local' }).click();
    await expect(
      owner.page.getByRole('heading', { name: 'Encontrado em Empório A' }),
    ).toBeVisible();
    await page.goto(url);
    await page.getByRole('button', { name: 'Este resultado me ajudou' }).click();
    await expect(page.getByRole('button', { name: 'Obrigado por registrar!' })).toBeDisabled();
    await owner.page.goto(
      '/app?' + new URLSearchParams({ city: '3549805', status: 'RESOLVED', q: 'Paginação' }),
    );
    const card = owner.page
      .locator('.request-row')
      .filter({ hasText: 'Paginação independente dos estabelecimentos' });
    await expect(card).toContainText('Local confirmado pela comunidade');
    const beforePreview = details.length;
    await card.getByText('Ver local confirmado', { exact: true }).click();
    await expect(card.getByRole('heading', { name: 'Empório A', exact: true })).toBeVisible();
    expect(details).toHaveLength(beforePreview + 1);
    await card.getByText('Ver local confirmado', { exact: true }).click();
    await card.getByText('Ver local confirmado', { exact: true }).click();
    expect(details).toHaveLength(beforePreview + 1);
  } finally {
    await owner.ctx.close();
    await guest.close();
  }
});
test('instalação usa manifest e offline armazena somente página neutra', async ({
  page,
  context,
}) => {
  await page.goto('/');
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);
  expect((await manifest.json()).display).toBe('standalone');
  await expect
    .poll(() => page.evaluate(async () => Boolean(await navigator.serviceWorker.getRegistration())))
    .toBe(true);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await context.setOffline(true);
  await page.goto('/app');
  await expect(page.getByRole('heading', { name: 'Estamos sem conexão.' })).toBeVisible();
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (
      await Promise.all(
        keys
          .filter((k) => k.startsWith('goindica-offline'))
          .map(async (k) =>
            (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname),
          ),
      )
    ).flat();
  });
  expect(cached).toEqual(['/offline.html']);
  await context.setOffline(false);
});

test('pedido compartilhado volta ao mesmo destino após cadastro, confirmação em outro navegador e onboarding', async ({
  browser,
  request,
}) => {
  const owner = await context(browser, 'Sofia', 'sofia_teste'),
    visitor = await browser.newContext(),
    confirmed = await browser.newContext();
  try {
    await owner.page.goto('/pedidos/novo');
    await owner.page
      .getByLabel('O que você está procurando?')
      .fill('Pedido para acesso compartilhado por e-mail');
    await owner.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await owner.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const path = new URL(owner.page.url()).pathname;
    const page = await visitor.newPage();
    await page.goto(path);
    await page.getByRole('link', { name: 'Criar uma conta' }).click();
    await expect(page).toHaveURL(/\/cadastro\?/);
    const email = 'shared-' + randomUUID() + '@test.invalid';
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page
      .getByLabel('Crie uma senha', { exact: true })
      .fill('Senha para testar compartilhamento 123');
    await page
      .getByLabel('Repita a senha', { exact: true })
      .fill('Senha para testar compartilhamento 123');
    await page.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(page.getByRole('status')).toContainText('Confira seu e-mail');
    const mail = await (
      await request.get('http://localhost:3456/test-mail?email=' + encodeURIComponent(email))
    ).json();
    expect(new URL(mail.redirectTo).searchParams.get('next')).toBe(path);
    const returning = await confirmed.newPage();
    await returning.goto(
      '/auth/confirm?' +
        new URLSearchParams({ type: 'email', token_hash: mail.tokenHash, next: mail.redirectTo }),
    );
    await expect(returning).toHaveURL(/\/onboarding\?next=/);
    await returning.getByLabel('Nome de exibição', { exact: true }).fill('Visitante do pedido');
    await returning
      .getByLabel('Nome de usuário', { exact: true })
      .fill('shared_' + randomUUID().replaceAll('-', '').slice(0, 10));
    await returning.getByRole('combobox').fill('São José do Rio Preto');
    await returning.getByRole('option', { name: 'São José do Rio Preto SP', exact: true }).click();
    await returning.getByRole('button', { name: 'Concluir e entrar' }).click();
    await expect(returning).toHaveURL(new RegExp(path + '$'));
    await expect(
      returning.getByRole('heading', { name: 'Pedido para acesso compartilhado por e-mail' }),
    ).toBeVisible();
  } finally {
    await owner.ctx.close();
    await visitor.close();
    await confirmed.close();
  }
});
