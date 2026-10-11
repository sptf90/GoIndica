import 'server-only';
import { timingSafeEqual } from 'node:crypto';
export function authorizedCron(header: string | null, secret: string | undefined) {
  if (!secret || secret.length < 32 || !header) return false;
  const received = Buffer.from(header),
    expected = Buffer.from('Bearer ' + secret);
  return received.length === expected.length && timingSafeEqual(received, expected);
}
