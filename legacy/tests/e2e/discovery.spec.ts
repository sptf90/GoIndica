import { test, expect } from '@playwright/test';
import { context } from './helpers';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { readFile } from 'node:fs/promises';

test('foto, pedidos sem ajuda, também procuro, alertas, reconfirmação e card completam o fluxo', async ({
  browser,
  browserName,
}, testInfo) => {
  test.setTimeout(120000);
  const owner = await context(browser, 'Paula', 'paula_teste');
  const helper = await context(browser, 'Diego', 'diego_teste');
  try {
    await helper.page.goto('/perfil');
    const beforePoints = Number(
      await helper.page
        .locator('.profile-stats p')
        .filter({ hasText: 'pontos' })
        .locator('strong')
        .textContent(),
    );
    await helper.page.goto('/preferencias');
    const alertForm = helper.page
      .locator('form')
      .filter({ has: helper.page.getByRole('button', { name: 'Criar alerta', exact: true }) });
    await alertForm.getByLabel('Assunto do alerta').fill('máquina café');
    await alertForm.getByRole('button', { name: 'Criar alerta' }).click();
    await expect(helper.page.locator('.topic-alert-list')).toContainText('máquina café');

    await owner.page.goto('/pedidos/novo');
    const description = 'Peça especial para máquina de café da comunidade · ' + browserName;
    await owner.page.getByLabel('O que você está procurando?').fill(description);
    const photo = await sharp({
      create: { width: 1800, height: 1000, channels: 3, background: '#347d25' },
    })
      .png()
      .toBuffer();
    await owner.page
      .getByLabel('Foto do que você procura')
      .setInputFiles({ name: 'item.png', mimeType: 'image/png', buffer: photo });
    await expect(owner.page.getByAltText('Prévia da foto do pedido')).toBeVisible();
    await owner.page.getByRole('button', { name: 'Publicar pedido', exact: true }).click();
    await owner.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const url = owner.page.url();
    const id = new URL(url).pathname.split('/').pop()!;
    await expect(owner.page.getByAltText('Foto do item procurado neste pedido')).toBeVisible();
    const image = await owner.page.request.get('/api/request-photo?id=' + id);
    expect(image.status()).toBe(200);
    expect(image.headers()['cache-control']).toContain('no-store');
    const metadata = await sharp(await image.body()).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBeLessThanOrEqual(1200);
    expect(metadata.exif).toBeUndefined();

    await owner.page.getByRole('link', { name: 'Editar pedido', exact: true }).click();
    await owner.page.getByRole('button', { name: 'Remover foto', exact: true }).click();
    await owner.page.getByRole('button', { name: 'Salvar pedido', exact: true }).click();
    await expect(owner.page).toHaveURL(url);
    await expect(owner.page.getByAltText('Foto do item procurado neste pedido')).toHaveCount(0);
    await owner.page.getByRole('link', { name: 'Editar pedido', exact: true }).click();
    await owner.page
      .getByLabel('Foto do que você procura')
      .setInputFiles({ name: 'nova.png', mimeType: 'image/png', buffer: photo });
    await owner.page.getByRole('button', { name: 'Salvar pedido', exact: true }).click();
    await expect(owner.page).toHaveURL(url);
    await expect(owner.page.getByAltText('Foto do item procurado neste pedido')).toBeVisible();
    await owner.page.screenshot({
      path: testInfo.outputPath('pedido-com-foto-mobile.png'),
      fullPage: true,
    });

    await helper.page.goto('/notificacoes');
    const alertRow = helper.page
      .locator('.community-row')
      .filter({ has: helper.page.getByRole('link', { name: description + ' ↗', exact: true }) })
      .filter({ hasText: 'Um novo pedido combina com seus assuntos' });
    await expect(alertRow).toHaveCount(1);
    await helper.page.getByRole('link', { name: description + ' ↗', exact: true }).click();
    await helper.page.getByRole('button', { name: 'Também estou procurando', exact: true }).click();
    await expect(
      helper.page.getByRole('button', { name: 'Deixar de procurar junto', exact: true }),
    ).toBeVisible();
    await helper.page.locator('.request-options > summary').click();
    await expect(
      helper.page.getByRole('button', { name: 'Deixar de acompanhar', exact: true }),
    ).toBeVisible();
    await expect(helper.page.locator('.request-community-interest')).toContainText(
      '1 pessoa também procura isso',
    );
    await helper.page.getByRole('button', { name: 'Deixar de procurar junto' }).click();
    await expect(
      helper.page.getByRole('button', { name: 'Também estou procurando', exact: true }),
    ).toBeVisible();
    await helper.page.getByRole('button', { name: 'Também estou procurando', exact: true }).click();

    const downloadPromise = helper.page.waitForEvent('download');
    await helper.page.getByRole('button', { name: 'Baixar card para compartilhar' }).click();
    const download = await downloadPromise;
    const cardPath = testInfo.outputPath('card-compartilhar.png');
    await download.saveAs(cardPath);
    const { data, info } = await sharp(await readFile(cardPath))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(url);
    expect(info.width).toBe(1080);
    expect(info.height).toBe(1350);

    await helper.page.goto('/app?q=Peça%20especial%20máquina%20café');
    await helper.page.getByRole('link', { name: 'Sem indicação', exact: true }).click();
    await expect(helper.page.locator('.request-list')).toContainText(description);
    await expect(helper.page.locator('.request-list')).toContainText('Com foto');
    await helper.page.getByRole('link', { name: description, exact: true }).click();
    await helper.page.getByRole('link', { name: 'Indicar local' }).click();
    await helper.page.getByLabel('Nome do estabelecimento').fill('Empório');
    await helper.page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await helper.page.getByRole('button', { name: /Empório A,/ }).click();
    await helper.page.getByRole('button', { name: 'Confirmar indicação' }).click();
    await expect(helper.page).toHaveURL(/enviado=1/);
    await helper.page.goto('/app?q=Peça%20especial%20máquina%20café&status=UNANSWERED');
    await expect(helper.page.getByRole('link', { name: description, exact: true })).toHaveCount(0);

    await owner.page.reload();
    await expect(owner.page.getByRole('link', { name: 'Editar pedido', exact: true })).toHaveCount(
      0,
    );
    owner.page.once('dialog', (dialog) => dialog.accept());
    await owner.page.getByRole('button', { name: 'Ver indicações' }).click();
    await expect(owner.page.getByRole('heading', { name: 'Empório A', exact: true })).toBeVisible();
    owner.page.once('dialog', (dialog) => dialog.accept());
    await owner.page.getByRole('button', { name: 'Encontrei neste local' }).click();
    await expect(
      owner.page.getByRole('heading', { name: 'Encontrado em Empório A' }),
    ).toBeVisible();
    await helper.page.goto(url);
    helper.page.once('dialog', (dialog) => dialog.accept());
    await helper.page.getByRole('button', { name: 'Encontrei aqui também', exact: true }).click();
    await expect(helper.page.getByText(/Você encontrou aqui também em/)).toBeVisible();
    await expect(
      helper.page.getByRole('button', { name: 'Encontrei aqui também', exact: true }),
    ).toHaveCount(0);
    await helper.page.reload();
    await expect(helper.page.locator('.discovery-reconfirmations')).toContainText(
      '1 pessoa encontrou aqui também',
    );
    await helper.page.goto('/perfil');
    await expect(
      helper.page.locator('.profile-stats p').filter({ hasText: 'pontos' }).locator('strong'),
    ).toHaveText(String(beforePoints + 10));
    await helper.page.goto('/app?status=RESOLVED&q=Peça%20especial%20máquina%20café');
    await expect(helper.page.locator('.request-list')).toContainText('Última confirmação em');
    await helper.page.goto('/preferencias');
    await helper.page.getByRole('button', { name: 'Remover alerta', exact: true }).click();
    await expect(helper.page.locator('.topic-alert-list .community-row')).toHaveCount(0);
  } finally {
    await owner.ctx.close();
    await helper.ctx.close();
  }
});

test('upload inválido preserva formulário e novas telas não excedem a largura do celular', async ({
  browser,
}, testInfo) => {
  const user = await context(browser, 'Rita', 'rita_teste');
  try {
    await user.page.goto('/pedidos/novo');
    await user.page.getByLabel('O que você está procurando?').fill('Pedido com arquivo inválido');
    await user.page.getByLabel('Foto do que você procura').setInputFiles({
      name: 'fake.jpg',
      mimeType: 'image/jpeg',
      buffer: Buffer.from('not a JPEG'),
    });
    await user.page.getByRole('button', { name: 'Publicar pedido', exact: true }).click();
    await expect(user.page.locator('form').getByRole('alert')).toContainText(
      'foto JPG, PNG ou WebP válida',
    );
    await expect(user.page.getByLabel('O que você está procurando?')).toHaveValue(
      'Pedido com arquivo inválido',
    );
    await user.page.getByLabel('Foto do que você procura').setInputFiles([]);
    await user.page.getByRole('button', { name: 'Publicar pedido', exact: true }).click();
    await user.page.waitForURL(/\/pedidos\/[a-f0-9-]+$/);
    const path = new URL(user.page.url()).pathname;
    for (const width of [320, 390, 768, 1440]) {
      await user.page.setViewportSize({ width, height: 900 });
      for (const route of [path, '/preferencias', '/app?status=UNANSWERED']) {
        await user.page.goto(route);
        await expect(user.page.getByRole('heading', { level: 1 })).toBeVisible();
        expect(
          await user.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        ).toBe(true);
      }
      await user.page.screenshot({
        path: testInfo.outputPath('sem-indicacao-' + width + '.png'),
        fullPage: true,
      });
    }
    const guest = await browser.newContext();
    try {
      const page = await guest.newPage();
      expect(
        (await page.request.get('/api/request-photo?id=' + path.split('/').pop())).status(),
      ).toBe(401);
      expect((await page.request.get('/api/share-card?id=' + path.split('/').pop())).status()).toBe(
        401,
      );
    } finally {
      await guest.close();
    }
  } finally {
    await user.ctx.close();
  }
});
