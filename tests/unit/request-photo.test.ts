import { test, expect } from 'vitest';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { prepareRequestPhoto, maximumPhotoBytes } from '@/lib/request-photo';

test('processa foto real, limita dimensões e remove metadados', async () => {
  const source = await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: '#347d25' },
  })
    .jpeg()
    .withMetadata({ orientation: 6 })
    .toBuffer();
  const photo = await prepareRequestPhoto(new File([source], 'foto.jpg', { type: 'image/jpeg' }));
  expect(photo).toBeTruthy();
  const metadata = await sharp(Buffer.from(photo!, 'base64')).metadata();
  expect(metadata.format).toBe('jpeg');
  expect(metadata.width).toBeLessThanOrEqual(1200);
  expect(metadata.height).toBeLessThanOrEqual(1200);
  expect(metadata.exif).toBeUndefined();
  expect(metadata.orientation).toBeUndefined();
});
test('foto opcional aceita campo vazio e rejeita conteúdo adulterado, SVG e excesso de tamanho', async () => {
  expect(await prepareRequestPhoto(null)).toBeNull();
  expect(await prepareRequestPhoto(new File([], ''))).toBeNull();
  await expect(prepareRequestPhoto('fake')).rejects.toThrow('INVALID_PHOTO');
  await expect(
    prepareRequestPhoto(new File(['<svg/>'], 'photo.svg', { type: 'image/svg+xml' })),
  ).rejects.toThrow('INVALID_PHOTO');
  await expect(
    prepareRequestPhoto(new File(['not a photo'], 'fake.jpg', { type: 'image/jpeg' })),
  ).rejects.toThrow('INVALID_PHOTO');
  await expect(
    prepareRequestPhoto(
      new File([new Uint8Array(maximumPhotoBytes + 1)], 'huge.jpg', { type: 'image/jpeg' }),
    ),
  ).rejects.toThrow('PHOTO_TOO_LARGE');
});

test('foto detalhada dentro do limite é comprimida para caber no armazenamento', async () => {
  const pixels = randomBytes(1200 * 1200 * 3);
  const source = await sharp(pixels, { raw: { width: 1200, height: 1200, channels: 3 } })
    .png()
    .toBuffer();
  expect(source.byteLength).toBeLessThan(maximumPhotoBytes);
  const result = await prepareRequestPhoto(
    new File([source], 'detalhada.png', { type: 'image/png' }),
  );
  expect(Buffer.from(result!, 'base64').byteLength).toBeLessThanOrEqual(512 * 1024);
});
