import { randomUUID } from 'node:crypto';
import { test, expect, type Page, type APIRequestContext } from '@playwright/test';

const password = 'Minha senha de teste 123!';
const newPassword = 'Minha outra senha de teste 456!';
async function fillLogin(page: Page, email: string, secret: string) {
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(secret);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}
async function mailLink(request: APIRequestContext, email: string) {
  const response = await request.get(
    'http://localhost:3456/test-mail?email=' + encodeURIComponent(email),
  );
  const mail = (await response.json()) as { tokenHash: string; type: string };
  expect(mail?.tokenHash).toBeTruthy();
  return `/auth/confirm?token_hash=${mail.tokenHash}&type=${mail.type}`;
}

test('cadastro por e-mail, confirmação em outro navegador, onboarding, login e recuperação', async ({
  browser,
  request,
}) => {
  const email = `pessoa-${randomUUID()}@test.invalid`;
  const registering = await browser.newContext();
  const member = await browser.newContext();
  try {
    const signup = await registering.newPage();
    await signup.goto('/entrar');
    await signup.getByRole('link', { name: 'Criar uma conta' }).click();
    await expect(
      signup.getByRole('heading', { name: 'Crie sua conta', exact: true }),
    ).toBeVisible();
    await signup.getByLabel('E-mail', { exact: true }).fill(email);
    await signup.getByLabel('Crie uma senha', { exact: true }).fill(password);
    await signup.getByLabel('Repita a senha', { exact: true }).fill(password + 'x');
    await signup.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(signup.locator('.action-form').getByRole('alert')).toHaveText(
      'As senhas precisam ser iguais.',
    );
    await expect(signup.getByLabel('E-mail', { exact: true })).toHaveValue(email);
    await expect(signup.getByLabel('Crie uma senha', { exact: true })).toHaveValue(password);
    await expect(signup.getByLabel('Repita a senha', { exact: true })).toBeFocused();
    await signup.getByLabel('Repita a senha', { exact: true }).fill(password);
    await signup.getByRole('button', { name: 'Criar conta', exact: true }).click();
    await expect(signup.getByRole('status')).toContainText('Confira seu e-mail');
    await signup.goto('/entrar');
    await fillLogin(signup, email, password);
    await expect(signup.locator('.action-form').getByRole('alert')).toContainText(
      'Confirme seu e-mail',
    );
    await signup.goto('/app');
    await expect(signup).toHaveURL(/\/entrar/);

    const page = await member.newPage();
    const confirmation = await mailLink(request, email);
    await page.goto(confirmation + '&next=https://evil.example');
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByLabel('Usar minha foto do Google')).toHaveCount(0);
    await page.getByLabel('Nome de exibição', { exact: true }).fill('Pessoa por e-mail');
    await page
      .getByLabel('Nome de usuário', { exact: true })
      .fill('email_' + randomUUID().replaceAll('-', '').slice(0, 10));
    await page.getByLabel('Cidade', { exact: true }).fill('São José do Rio Preto');
    await page.getByRole('option', { name: 'São José do Rio Preto SP', exact: true }).click();
    await page.getByRole('button', { name: 'Concluir e entrar' }).click();
    await expect(page).toHaveURL(/\/app$/);
    await page.goto('/pedidos/novo');
    await page.getByLabel('O que você está procurando?').fill('Chave de fenda para bicicleta');
    await page.getByRole('button', { name: 'Publicar pedido' }).click();
    await expect(page).toHaveURL(/\/pedidos\/[a-f0-9-]+$/);
    await page.goto('/perfil');
    await page.getByRole('button', { name: 'Sair da conta', exact: true }).click();
    await page.goto('/entrar');
    await fillLogin(page, email, 'senha incorreta de teste');
    await expect(page.locator('.action-form').getByRole('alert')).toHaveText(
      'E-mail ou senha incorretos.',
    );
    await fillLogin(page, email, password);
    await expect(page).toHaveURL(/\/app$/);

    await page.goto('/recuperar-senha');
    await page.getByLabel('E-mail', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
    await expect(page.getByRole('status')).toContainText('Se houver uma conta');
    const recovery = await mailLink(request, email);
    await page.goto(recovery);
    await expect(page).toHaveURL(/\/nova-senha$/);
    await page.getByLabel('Crie uma senha', { exact: true }).fill(newPassword);
    await page.getByLabel('Repita a senha', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(page).toHaveURL(/\/entrar\?motivo=senha_atualizada/);
    await expect(page.getByRole('status')).toContainText('Senha atualizada');
    await page.goto('/app');
    await expect(page).toHaveURL(/\/entrar/);
    await fillLogin(page, email, password);
    await expect(page.locator('.action-form').getByRole('alert')).toHaveText(
      'E-mail ou senha incorretos.',
    );
    await fillLogin(page, email, newPassword);
    await expect(page).toHaveURL(/\/app$/);
    await signup.goto(confirmation);
    await expect(signup).toHaveURL(/\/entrar\?motivo=link_expirado/);
    await signup.goto(recovery);
    await expect(signup).toHaveURL(/\/recuperar-senha\?motivo=link_expirado/);
  } finally {
    await registering.close();
    await member.close();
  }
});

test('links inválidos e troca sem sessão não autenticam nem redirecionam para fora', async ({
  page,
}) => {
  await page.goto('/nova-senha');
  await expect(page).toHaveURL(/\/recuperar-senha\?motivo=link_expirado/);
  await page.goto(
    '/auth/confirm?type=invite&token_hash=' + 'a'.repeat(64) + '&next=https://evil.example',
  );
  await expect(page).toHaveURL(/\/entrar\?motivo=link_expirado/);
  await page.goto('/auth/confirm?type=recovery&token_hash=' + 'a'.repeat(64));
  await expect(page).toHaveURL(/\/recuperar-senha\?motivo=link_expirado/);
  await page.goto('/recuperar-senha');
  await page.getByLabel('E-mail', { exact: true }).fill('ausente@test.invalid');
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByRole('status')).toContainText('Se houver uma conta');
});

for (const width of [320, 375, 390, 414, 768, 1024, 1440])
  test(`acesso por e-mail responsivo e com campos acessíveis: ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    for (const path of ['/entrar', '/cadastro', '/recuperar-senha']) {
      await page.goto(path);
      await expect(page.getByLabel('E-mail', { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.screenshot({ path: `test-results/email-auth-${width}.png`, fullPage: true });
  });
