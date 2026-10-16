import { beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  autocomplete: vi.fn(),
  select: vi.fn(),
  register: vi.fn(),
  call: vi.fn(),
}));
vi.mock('@/server/api-auth', () => ({ apiMember: mocks.member }));
vi.mock('@/lib/google-places', () => ({ autocomplete: mocks.autocomplete }));
vi.mock('@/lib/places', () => ({ selectGooglePlace: mocks.select, registerPlace: mocks.register }));
vi.mock('@/lib/observability', () => ({ operationalError: vi.fn() }));
import { GET, POST } from '@/app/api/places/route';
const token = 'd632082a-3498-452a-ad33-c7f45bac7733';
const city = { id: 3549805, name: 'São José do Rio Preto' };
const get = () =>
  new NextRequest(`http://localhost/api/places?input=Loja&cityId=3549805&sessionToken=${token}`);
const post = (origin = 'http://localhost') =>
  new NextRequest('http://localhost/api/places', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({
      googlePlaceId: 'ChIJ_test',
      cityId: city.id,
      sessionToken: token,
      name: 'forjado',
    }),
  });
beforeEach(() => {
  vi.resetAllMocks();
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: city, error: null }),
  };
  mocks.member.mockResolvedValue({
    user: { id: 'actor' },
    db: { from: () => chain, call: mocks.call },
  });
  mocks.call.mockResolvedValue({ data: null, error: null });
  mocks.autocomplete.mockResolvedValue([{ id: 'ChIJ_test', label: 'Loja' }]);
  mocks.select.mockResolvedValue({ id: 'local-id', label: 'Nome oficial' });
});
test('busca autenticada passa sessão e cidade ao Google e não permite cache', async () => {
  const response = await GET(get());
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(mocks.autocomplete).toHaveBeenCalledWith('Loja', city, token);
});
test('seleção usa somente ID e dados oficiais, sem cadastrar texto forjado', async () => {
  expect((await POST(post())).status).toBe(200);
  expect(mocks.select).toHaveBeenCalledWith('actor', city, 'ChIJ_test', token);
  expect(mocks.register).not.toHaveBeenCalled();
});
test('nega acesso sem sessão, origem externa e cota excedida antes do Google', async () => {
  expect((await POST(post('https://external.invalid'))).status).toBe(403);
  mocks.member.mockResolvedValue(null);
  expect((await GET(get())).status).toBe(401);
  mocks.member.mockResolvedValue({ db: { call: mocks.call } });
  mocks.call.mockResolvedValue({ error: new Error('RATE_LIMITED'), data: null });
  expect((await GET(get())).status).toBe(429);
  expect(mocks.autocomplete).not.toHaveBeenCalled();
  expect(mocks.select).not.toHaveBeenCalled();
});
test('falha de validação não informa uma seleção válida', async () => {
  mocks.select.mockRejectedValue(new Error('INVALID_CITY'));
  expect((await POST(post())).status).toBe(400);
});
