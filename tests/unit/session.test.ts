import { beforeEach, test, expect, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  state: vi.fn(),
  profile: vi.fn(),
  log: vi.fn(),
  destination: '/app',
}));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-auth-destination': mocks.destination }),
}));
vi.mock('next/navigation', () => ({
  redirect: (value: string) => {
    throw new Error('REDIRECT:' + value);
  },
}));
vi.mock('@/lib/env', () => ({ configured: () => true }));
vi.mock('@/lib/observability', () => ({ operationalError: mocks.log }));
vi.mock('@/lib/database/server', () => ({
  database: async () => ({
    auth: { getUser: mocks.user },
    call: mocks.state,
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }) }),
  }),
}));
import { member } from '@/server/auth';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.destination = '/app';
  mocks.user.mockResolvedValue({ data: { user: { id: 'person' } }, error: null });
  mocks.state.mockResolvedValue({ data: { admin: false, onboarded: true }, error: null });
  mocks.profile.mockResolvedValue({ data: { id: 'person' }, error: null });
});

test('indisponibilidade da conta não é classificada como bloqueio', async () => {
  mocks.state.mockResolvedValue({ error: { code: '503', message: 'provider unavailable' } });
  await expect(member()).rejects.toThrow('SERVICE_UNAVAILABLE');
  expect(mocks.log).toHaveBeenCalledWith('auth.account', expect.any(Object));
});
test('falha de leitura do perfil não leva ao onboarding', async () => {
  mocks.profile.mockResolvedValue({ data: null, error: { message: 'timeout' } });
  await expect(member()).rejects.toThrow('SERVICE_UNAVAILABLE');
});
test('perfil realmente ausente preserva destino no onboarding', async () => {
  mocks.destination = '/pedidos/00000000-0000-0000-0000-000000000001';
  mocks.profile.mockResolvedValue({ data: null, error: null });
  await expect(member()).rejects.toThrow('REDIRECT:/onboarding?next=');
});
test('bloqueio explícito e visitante mantêm comportamentos distintos', async () => {
  mocks.state.mockResolvedValue({ error: { message: 'ACCOUNT_BLOCKED', code: 'P0001' } });
  await expect(member()).rejects.toThrow('REDIRECT:/entrar?motivo=bloqueado');
  mocks.user.mockResolvedValue({ data: { user: null }, error: null });
  await expect(member()).rejects.toThrow('REDIRECT:/entrar');
});
