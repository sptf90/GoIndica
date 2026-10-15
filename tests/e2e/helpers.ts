import { expect, type Page, type Browser } from '@playwright/test';
export const password = 'Senha longa de teste 123!';
export async function login(page: Page, name: string, username: string) {
  await page.goto('/entrar');
  await page.getByLabel('E-mail', { exact: true }).fill(username + '@test.invalid');
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Vamos nos conhecer\?|O que você está procurando\?/,
  );
  if (page.url().includes('/onboarding')) {
    await page.getByLabel('Nome de exibição', { exact: true }).fill(name);
    await page.getByLabel('Nome de usuário', { exact: true }).fill(username);
    await page
      .getByLabel('Cidade', { exact: true })
      .fill(name === 'Maria' ? 'Mirassol' : 'São José do Rio Preto');
    await page
      .getByRole('option', {
        name: name === 'Maria' ? 'Mirassol SP' : 'São José do Rio Preto SP',
        exact: true,
      })
      .click();
    await page.getByRole('button', { name: 'Concluir e entrar' }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
}
export async function context(browser: Browser, name: string, username: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } }),
    page = await ctx.newPage();
  await login(page, name, username);
  return { ctx, page };
}
