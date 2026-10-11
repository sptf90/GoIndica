import { test, expect } from 'vitest';
import { accessLink, callbackDestination, returnPath } from '@/lib/return-path';

test('preserva pedido e filtros internos', () => {
  const path = '/pedidos/00000000-0000-0000-0000-000000000001/indicar';
  expect(returnPath(path)).toBe(path);
  expect(returnPath('/app?city=3549805&q=farinha')).toBe('/app?city=3549805&q=farinha');
  expect(accessLink('/cadastro', path)).toContain(encodeURIComponent(path));
  expect(
    callbackDestination(
      'https://app.example/auth/callback?next=' + encodeURIComponent(path),
      'https://app.example',
    ),
  ).toBe(path);
});
test.each([
  'https://evil.example',
  '//evil.example',
  '/\\evil.example',
  '/app/../auth/callback',
  '/%61pp',
  '/auth/callback',
  '/api/analytics',
  '/onboarding',
  '/app\n',
  null,
])('rejeita destino fora das rotas permitidas: %s', (input) => {
  expect(returnPath(input)).toBe('/app');
});
