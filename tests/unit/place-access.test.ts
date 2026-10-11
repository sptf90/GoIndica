import { beforeEach, test, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  details: vi.fn(),
  rpc: vi.fn(),
  row: { id: '', requester_id: 'owner', status: 'OPEN', hidden_at: null as string | null },
  resolution: null as { place_id: string } | null,
}));
vi.mock('@/server/api-auth', () => ({ apiMember: mocks.member }));
vi.mock('@/lib/google/places', () => ({ placeDetails: mocks.details }));
vi.mock('@/lib/observability', () => ({ operationalError: vi.fn() }));
import { GET } from '@/app/api/place-details/route';
const requestId = '00000000-0000-4000-8000-000000000001',
  placeId = '00000000-0000-4000-8000-000000000002';
const request = () =>
  new NextRequest(
    'http://localhost:3000/api/place-details?' + new URLSearchParams({ requestId, placeId }),
  );
beforeEach(() => {
  vi.resetAllMocks();
  mocks.row = { id: requestId, requester_id: 'owner', status: 'OPEN', hidden_at: null };
  mocks.resolution = null;
  const from = (table: string) => {
    const chain = {
      select: () => chain,
      eq: () => chain,
      maybeSingle: async () => ({
        data:
          table === 'requests'
            ? mocks.row
            : table === 'request_resolutions'
              ? mocks.resolution
              : { google_place_id: 'verified_place' },
        error: null,
      }),
      limit: async () => ({ data: [{ id: 'indication' }], error: null }),
    };
    return chain;
  };
  mocks.member.mockResolvedValue({
    db: { from, rpc: mocks.rpc },
    user: { id: 'owner' },
    admin: false,
  });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.details.mockResolvedValue({ id: 'verified_place' });
});
test('dono não consulta local antes de abrir as indicações', async () => {
  expect((await GET(request())).status).toBe(403);
  expect(mocks.details).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test('dono após revelação consome apenas cota de visualização', async () => {
  mocks.row.status = 'REVEALED';
  expect((await GET(request())).status).toBe(200);
  expect(mocks.rpc).toHaveBeenCalledWith('consume_api_limit', { p_bucket: 'places_view' });
  expect(mocks.details).toHaveBeenCalledWith('verified_place');
});
test('terceiro consulta somente local confirmado, sem acesso aos grupos privados', async () => {
  mocks.row.requester_id = 'someone';
  mocks.row.status = 'REVEALED';
  expect((await GET(request())).status).toBe(403);
  mocks.row.status = 'RESOLVED';
  mocks.resolution = { place_id: requestId };
  expect((await GET(request())).status).toBe(403);
  mocks.resolution = { place_id: placeId };
  expect((await GET(request())).status).toBe(200);
});
test('limite e indisponibilidade produzem respostas diferentes', async () => {
  mocks.row.status = 'REVEALED';
  mocks.rpc.mockResolvedValue({ data: null, error: { message: 'RATE_LIMITED' } });
  expect((await GET(request())).status).toBe(429);
  expect(mocks.details).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.details.mockRejectedValue(new Error('PLACES_UNAVAILABLE'));
  expect((await GET(request())).status).toBe(503);
});

test('identidade bloqueada durante a leitura responde 401 e não consulta o Google', async () => {
  mocks.member.mockRejectedValue(new Error('ACCOUNT_BLOCKED'));
  expect((await GET(request())).status).toBe(401);
  expect(mocks.details).not.toHaveBeenCalled();
});
