import { beforeEach, test, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ call: vi.fn(), log: vi.fn() }));
vi.mock('@/lib/env', () => ({ configured: () => true, appUrl: () => 'http://localhost:3000' }));
vi.mock('@/lib/database/admin', () => ({ serviceClient: () => ({ call: mocks.call }) }));
vi.mock('@/lib/observability', () => ({ operationalError: mocks.log }));
import { POST } from '@/app/api/analytics/route';
import { sendEvent } from '@/lib/analytics-client';
import { smallJson } from '@/lib/http';
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CRON_SECRET', 'server-test-key');
  mocks.call.mockResolvedValue({ data: null, error: null });
});
function request(body = '{"event":"LANDING_VISIT"}', cookie?: string) {
  return new NextRequest('http://localhost:3000/api/analytics', {
    method: 'POST',
    headers: { origin: 'http://localhost:3000', ...(cookie ? { cookie } : {}) },
    body,
  });
}
test('falha retornada pela RPC é visível e não cria cookie de entrega', async () => {
  mocks.call.mockResolvedValue({
    data: null,
    error: { message: 'Provider unavailable', code: '503' },
  });
  const r = await POST(request());
  expect(r.status).toBe(503);
  expect(r.headers.get('set-cookie')).toBeNull();
  expect(mocks.log).toHaveBeenCalled();
});
test('sucesso define deduplicação, reenvio evita nova persistência', async () => {
  const r = await POST(request());
  expect(r.status).toBe(204);
  expect(r.headers.get('set-cookie')).toContain('event_landing_visit=1');
  await POST(request(undefined, 'event_landing_visit=1'));
  expect(mocks.call).toHaveBeenCalledTimes(1);
});
test('limite não grava cookie e responde com orientação de repetição', async () => {
  mocks.call.mockResolvedValue({ error: { message: 'RATE_LIMITED' }, data: null });
  const r = await POST(request());
  expect(r.status).toBe(429);
  expect(r.headers.get('retry-after')).toBe('60');
  expect(r.headers.get('set-cookie')).toBeNull();
});
test('body grande sem Content-Length também é rejeitado antes de persistir', async () => {
  const r = await POST(request('{"event":"' + 'A'.repeat(200) + '"}'));
  expect(r.status).toBe(413);
  expect(mocks.call).not.toHaveBeenCalled();
});
test('body inválido e origem cruzada não criam eventos', async () => {
  expect((await POST(request('not json'))).status).toBe(400);
  const cross = new NextRequest('http://localhost:3000/api/analytics', {
    method: 'POST',
    headers: { origin: 'https://external.invalid' },
    body: '{}',
  });
  expect((await POST(cross)).status).toBe(403);
  expect(mocks.call).not.toHaveBeenCalled();
});
test('falha de rede em analytics não quebra a navegação do cliente', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
  try {
    expect(await sendEvent('CTA_CLICK')).toBe(false);
  } finally {
    vi.unstubAllGlobals();
  }
});
test('limite de bytes também vale para corpo recebido em streaming', async () => {
  await expect(
    smallJson(new Request('http://localhost', { method: 'POST', body: '"ééé"' }), 4),
  ).rejects.toThrow('BODY_TOO_LARGE');
});
