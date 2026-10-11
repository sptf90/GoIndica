import { test, expect } from 'vitest';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { renderShareCard } from '@/lib/share-card';

test('card PNG tem dimensões corretas e QR code decodifica o endereço exato do pedido', async () => {
  const url = 'https://goindica.example/pedidos/00000000-0000-4000-8000-000000000001';
  const response = await renderShareCard({
    description: 'Peça para máquina de café',
    city: 'São José do Rio Preto — SP',
    url,
    resolved: false,
  });
  expect(response.headers.get('content-type')).toBe('image/png');
  const buffer = Buffer.from(await response.arrayBuffer());
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect(info.width).toBe(1080);
  expect(info.height).toBe(1350);
  expect(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data).toBe(url);
});
test('card aceita descrição máxima, palavra sem espaços e cidade longa', async () => {
  for (const description of [
    'Reposição para máquina de café '.repeat(10).slice(0, 300),
    'X'.repeat(300),
  ]) {
    const response = await renderShareCard({
      description,
      city: 'Vila Bela da Santíssima Trindade — MT',
      url: 'https://goindica.example/pedidos/teste',
      resolved: true,
    });
    const png = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(png).metadata();
    expect(metadata.height).toBe(1350);
    // Text must stay inside the right margin, even without spaces.
    const edge = await sharp(png)
      .extract({ left: 1010, top: 300, width: 70, height: 650 })
      .removeAlpha()
      .raw()
      .toBuffer();
    let darkPixels = 0;
    for (let i = 0; i < edge.length; i += 3)
      if (edge[i] < 150 && edge[i + 1] < 150 && edge[i + 2] < 150) darkPixels++;
    expect(darkPixels).toBe(0);
  }
});
