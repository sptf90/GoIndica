import 'server-only';
import sharp, { type Sharp } from 'sharp';

export const maximumPhotoBytes = 5 * 1024 * 1024;
async function preparePhoto(
  value: FormDataEntryValue | null,
  encode: (image: Sharp) => Promise<Buffer>,
) {
  if (value === null || (value instanceof File && value.size === 0)) return null;
  if (!(value instanceof File)) throw new Error('INVALID_PHOTO');
  if (value.size > maximumPhotoBytes) throw new Error('PHOTO_TOO_LARGE');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(value.type))
    throw new Error('INVALID_PHOTO');
  try {
    const input = Buffer.from(await value.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 24_000_000, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format || '') || (metadata.pages || 1) > 1)
      throw new Error('INVALID_PHOTO');
    // Re-encoding strips EXIF (including location), handles orientation and bounds storage.
    const output = await encode(image.rotate());
    if (output.byteLength > 512 * 1024) throw new Error('PHOTO_TOO_LARGE');
    return output.toString('base64');
  } catch (error) {
    if (error instanceof Error && error.message === 'PHOTO_TOO_LARGE') throw error;
    if (error instanceof Error && /pixel limit/i.test(error.message))
      throw new Error('PHOTO_DIMENSIONS');
    throw new Error('INVALID_PHOTO');
  }
}
export function prepareRequestPhoto(value: FormDataEntryValue | null) {
  return preparePhoto(value, async (image) => {
    const output = await image
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 78 })
      .toBuffer();
    if (output.byteLength <= 512 * 1024) return output;
    return sharp(output).resize(1000, 1000, { fit: 'inside' }).jpeg({ quality: 55 }).toBuffer();
  });
}
export function prepareProfilePhoto(value: FormDataEntryValue | null) {
  return preparePhoto(value, (image) =>
    image
      .resize(400, 400, { fit: 'cover', position: 'attention' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80 })
      .toBuffer(),
  );
}
