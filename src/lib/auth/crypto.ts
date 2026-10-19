import { randomBytes, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await derive(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const parts = stored?.split(':');
  const salt =
    parts?.[0] === 'scrypt' && /^[a-f0-9]{32}$/.test(parts[1]) ? parts[1] : '0'.repeat(32);
  const expected =
    parts?.[0] === 'scrypt' && /^[a-f0-9]{128}$/.test(parts[2])
      ? Buffer.from(parts[2], 'hex')
      : Buffer.alloc(64);
  const actual = (await derive(password, salt, 64)) as Buffer;
  return Boolean(stored && parts?.[0] === 'scrypt' && timingSafeEqual(actual, expected));
}
