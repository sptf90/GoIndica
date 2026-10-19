import { test, expect } from './fixtures';
import { context, password } from './helpers';
test('cadastro local de estabelecimento, indicação, pontos e exportação sem chamadas externas', async ({
  browser,
}) => {
  const owner = await context(browser, 'Paula', 'paula_teste'),
    helper = await context(browser, 'Bruno', 'bruno_teste');
  const external: string[] = [];
  for (const page of [owner.page, helper.page])
    page.on('request', (req) => {
      if (!req.url().startsWith('http://localhost:3100') && !req.url().startsWith('data:'))
        external.push(req.url());
    });
  try {
    await owner.page.goto('/pedidos/novo');
    await owner.page
      .getByLabel('O que você está procurando?')
      .fill('Filtro especial para cafeteira');
    await owner.page.getByRole('button', { name: 'Publicar pedido' }).click();
    await owner.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = owner.page.url();
    await helper.page.goto(url + '/indicar');
    await helper.page.getByText('Não encontrou? Cadastrar estabelecimento').click();
    await helper.page
      .getByLabel('Nome do novo estabelecimento', { exact: true })
      .last()
      .fill('Loja Comunitária');
    await helper.page
      .getByLabel('Endereço em São José do Rio Preto', { exact: true })
      .fill('Rua da Comunidade, 45, Centro');
    await helper.page.getByRole('button', { name: 'Cadastrar e selecionar' }).click();
    await expect(helper.page.locator('.selected-place')).toContainText('Loja Comunitária');
    await helper.page.getByRole('button', { name: 'Confirmar indicação' }).click();
    await expect(
      helper.page.getByText('Sua indicação foi recebida.', { exact: false }),
    ).toBeVisible();
    await owner.page.goto(url);
    await expect(owner.page.getByText('Loja Comunitária', { exact: true })).toHaveCount(0);
    owner.page.once('dialog', (d) => d.accept());
    await owner.page.getByRole('button', { name: 'Ver indicações', exact: true }).click();
    await expect(
      owner.page.getByRole('heading', { name: 'Loja Comunitária', exact: true }),
    ).toBeVisible();
    owner.page.once('dialog', (d) => d.accept());
    await owner.page.getByRole('button', { name: 'Encontrei neste local', exact: true }).click();
    await expect(
      owner.page.getByRole('heading', { name: 'Encontrado em Loja Comunitária' }),
    ).toBeVisible();
    const exported = await helper.page.request.get('/api/account/export');
    expect(exported.ok()).toBe(true);
    const body = await exported.json();
    expect(body.data.rewards.some((r: { points: number }) => r.points === 10)).toBe(true);
    expect(body.account.email).toBe('bruno_teste@test.invalid');
    const image = await owner.page.request.get(
      '/api/share-card?id=' + new URL(url).pathname.split('/').at(-1),
    );
    expect(image.ok()).toBe(true);
    expect(image.headers()['content-type']).toContain('image/png');
    expect(external).toEqual([]);
  } finally {
    await owner.ctx.close();
    await helper.ctx.close();
  }
});
test('alteração de e-mail confirma endereço novo via SMTP e troca senha revoga acessos anteriores', async ({
  browser,
  request,
}) => {
  const owner = await context(browser, 'Lia', 'lia_teste');
  try {
    await owner.page.goto('/conta');
    const form = owner.page.locator('form').filter({
      has: owner.page.getByRole('button', { name: 'Solicitar alteração', exact: true }),
    });
    await form.getByLabel('Senha atual').fill(password);
    await form.getByLabel('Novo e-mail').fill('lia-novo@test.invalid');
    await form.getByRole('button', { name: 'Solicitar alteração' }).click();
    await expect(form.getByRole('status')).toContainText('Confirme o novo endereço');
    const mail = await request.get('http://localhost:3456/test-mail?email=lia-novo@test.invalid');
    const message = await mail.json();
    expect(message.type).toBe('email_change');
    await owner.page.goto(message.url);
    await expect(owner.page).toHaveURL(/\/conta$/);
    await expect(owner.page.getByText('E-mail atual: lia-novo@test.invalid')).toBeVisible();
  } finally {
    await owner.ctx.close();
  }
});
