import { randomUUID } from 'node:crypto';
import { test, expect } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';

const password = 'Senha da empresa de teste 123!';
async function mailLink(request: APIRequestContext, email: string) {
  const response = await request.get(
    'http://localhost:3456/test-mail?email=' + encodeURIComponent(email),
  );
  const mail = (await response.json()) as { tokenHash: string; type: string } | null;
  expect(mail?.tokenHash).toBeTruthy();
  return `/auth/confirm?token_hash=${mail!.tokenHash}&type=${mail!.type}&next=/empresa`;
}
const cnpjStatus = (page: Page) => page.locator('#cnpj-status');

test('empresa se cadastra pelo CNPJ, confirma o e-mail e fica restrita ao painel', async ({
  browser,
  request,
}) => {
  test.setTimeout(90000);
  const email = `empresa-${randomUUID()}@test.invalid`;
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await page.goto('/cadastro');
    await page.getByRole('link', { name: 'Para minha empresa', exact: true }).click();
    await expect(page).toHaveURL(/tipo=empresa/);
    await expect(
      page.getByRole('heading', { name: 'Cadastre seu estabelecimento', exact: true }),
    ).toBeVisible();
    const submit = page.getByRole('button', { name: 'Criar conta da empresa', exact: true });
    await expect(submit).toBeDisabled();

    const cnpj = page.getByLabel('CNPJ do estabelecimento', { exact: true });
    await cnpj.fill('19131243000198');
    await expect(cnpjStatus(page)).toHaveText(
      'Confira o CNPJ: os dígitos verificadores não conferem.',
    );
    await cnpj.fill('19131243000197');
    await expect(cnpj).toHaveValue('19.131.243/0001-97');
    const card = page.getByRole('region', { name: 'Dados encontrados na Receita Federal' });
    await expect(card).toContainText('OPEN KNOWLEDGE BRASIL');
    await expect(card).toContainText('São José do Rio Preto — SP');
    await expect(page.getByLabel('Nome de apresentação', { exact: true })).toHaveValue(
      'Rede Pelo Conhecimento Livre',
    );
    await page.getByLabel('Nome de apresentação', { exact: true }).fill('Rede Livre');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByLabel('Crie uma senha', { exact: true }).fill(password);
    await page.getByLabel('Repita a senha', { exact: true }).fill(password);
    await page
      .getByLabel('Declaro que represento este estabelecimento e posso cadastrá-lo.')
      .check();
    await submit.click();
    await expect(page.locator('.action-form .notice.success')).toContainText(
      'Enviamos um link de confirmação',
    );

    await page.goto(await mailLink(request, email));
    await expect(page).toHaveURL(/\/empresa$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rede Livre');
    await expect(page.locator('.company-badge')).toContainText(
      'Dados conferidos na Receita Federal',
    );
    await expect(page.getByText('19.131.243/0001-97').first()).toBeVisible();

    for (const path of ['/app', '/pedidos/novo', '/perfil', '/ranking', '/onboarding']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/empresa$/);
    }
    expect((await page.request.get('/api/summary')).status()).toBe(401);

    await page.getByLabel('Nome de apresentação', { exact: true }).fill('Rede Livre Rio Preto');
    await page.getByRole('button', { name: 'Salvar nome', exact: true }).click();
    await expect(page.getByText('Nome de apresentação atualizado.')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rede Livre Rio Preto');

    const other = await browser.newContext();
    try {
      const again = await other.newPage();
      await again.goto('/cadastro?tipo=empresa');
      await again.getByLabel('CNPJ do estabelecimento', { exact: true }).fill('19131243000197');
      await expect(cnpjStatus(again)).toContainText('Este CNPJ já possui cadastro no GoIndica');
      await expect(
        again.getByRole('button', { name: 'Criar conta da empresa', exact: true }),
      ).toBeDisabled();
    } finally {
      await other.close();
    }
  } finally {
    await context.close();
  }
});

test('CNPJ inativo, inexistente ou sem resposta da Receita é recusado; há provedor reserva', async ({
  page,
}) => {
  await page.goto('/cadastro?tipo=empresa');
  const cnpj = page.getByLabel('CNPJ do estabelecimento', { exact: true });
  const submit = page.getByRole('button', { name: 'Criar conta da empresa', exact: true });
  await cnpj.fill('00000000000272');
  await expect(cnpjStatus(page)).toContainText('não está ativo');
  await expect(
    page.getByRole('region', { name: 'Dados encontrados na Receita Federal' }),
  ).toContainText('BAIXADA');
  await expect(submit).toBeDisabled();
  await cnpj.fill('12.abc.345/01de-35');
  await expect(cnpj).toHaveValue('12.ABC.345/01DE-35');
  await expect(cnpjStatus(page)).toContainText('não foi encontrado na Receita Federal');
  await expect(submit).toBeDisabled();
  await cnpj.fill('11222333000181');
  await expect(cnpjStatus(page)).toContainText('Não conseguimos consultar a Receita Federal');
  await expect(page.getByLabel('Razão social', { exact: true })).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await page.getByRole('button', { name: 'Consultar novamente', exact: true }).click();
  await expect(cnpjStatus(page)).toContainText('Não conseguimos consultar a Receita Federal');
  await cnpj.fill('11.444.777/0001-61');
  await expect(
    page.getByRole('region', { name: 'Dados encontrados na Receita Federal' }),
  ).toContainText('MERCADO RESERVA LTDA');
  await expect(page.getByLabel('Nome de apresentação', { exact: true })).toHaveValue(
    'Mercado Reserva',
  );
  await expect(submit).toBeEnabled();
});
