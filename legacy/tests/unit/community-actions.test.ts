import { beforeEach, test, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
  password: vi.fn(),
  update: vi.fn(),
  member: vi.fn(),
  admin: vi.fn(),
}));
vi.mock('@/server/auth', () => ({ member: mocks.member, administrator: mocks.admin }));
vi.mock('@/lib/supabase/admin', () => ({
  serviceClient: () => ({ auth: { admin: { getUserById: mocks.get, deleteUser: mocks.remove } } }),
}));
vi.mock('@/lib/env', () => ({ appUrl: () => 'http://localhost:3000' }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { reviewSupport, changePassword, changeEmail } from '@/server/community-actions';
const support = '00000000-0000-4000-8000-000000000001',
  user = '00000000-0000-4000-8000-000000000002';
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === 'prepare_account_closure' ? user : null,
    error: null,
  }));
  mocks.get.mockResolvedValue({ data: { user: { id: user } }, error: null });
  mocks.remove.mockResolvedValue({ data: { user: { id: user } }, error: null });
  const ctx = {
    db: { rpc: mocks.rpc, auth: { signInWithPassword: mocks.password, updateUser: mocks.update } },
    user: { id: user, email: 'old@test.invalid', app_metadata: { providers: ['email'] } },
  };
  mocks.member.mockResolvedValue(ctx);
  mocks.admin.mockResolvedValue(ctx);
  mocks.password.mockResolvedValue({ data: { user: {} }, error: null });
  mocks.update.mockResolvedValue({ data: { user: {} }, error: null });
});
const closing = () =>
  form({ id: support, decision: 'CLOSE', note: 'Solicitação revisada e dados anonimizados' });
test('encerramento usa exclusão lógica do Auth e só conclui depois do provedor', async () => {
  expect((await reviewSupport({}, closing())).success).toBeTruthy();
  expect(mocks.remove).toHaveBeenCalledWith(user, true);
  expect(mocks.rpc.mock.calls.map((c) => c[0])).toEqual([
    'prepare_account_closure',
    'complete_account_closure',
  ]);
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.rpc.mock.invocationCallOrder[1],
  );
});
test('falha do Auth não marca encerramento como concluído', async () => {
  mocks.remove.mockResolvedValue({
    data: { user: null },
    error: { message: 'Provider unavailable' },
  });
  expect((await reviewSupport({}, closing())).error).toBeTruthy();
  expect(mocks.rpc).not.toHaveBeenCalledWith('complete_account_closure', expect.anything());
});
test('repetição após exclusão lógica retoma anonimização sem excluir identidade novamente', async () => {
  mocks.get.mockResolvedValue({
    data: { user: { id: user, deleted_at: '2026-10-07T00:00:00Z' } },
    error: null,
  });
  expect((await reviewSupport({}, closing())).success).toBeTruthy();
  expect(mocks.remove).not.toHaveBeenCalled();
  expect(mocks.rpc).toHaveBeenCalledWith(
    'complete_account_closure',
    expect.objectContaining({ p_id: support }),
  );
});
test('senha atual errada e confirmação divergente não alteram credenciais', async () => {
  mocks.password.mockResolvedValue({ error: { code: 'invalid_credentials' } });
  const data = form({
    currentPassword: 'wrong',
    password: 'Nova senha válida 123',
    passwordConfirmation: 'Nova senha válida 123',
  });
  expect((await changePassword({}, data)).error).toContain('senha atual');
  expect(mocks.update).not.toHaveBeenCalled();
  data.set('passwordConfirmation', 'diferente');
  expect((await changePassword({}, data)).error).toContain('iguais');
});
test('novo e-mail é validado e normalizado após reautenticação', async () => {
  expect(
    (await changeEmail({}, form({ email: ' NEW@Test.Invalid ', currentPassword: 'Senha atual' })))
      .success,
  ).toBeTruthy();
  expect(mocks.password).toHaveBeenCalledWith({
    email: 'old@test.invalid',
    password: 'Senha atual',
  });
  expect(mocks.update).toHaveBeenCalledWith(
    { email: 'new@test.invalid' },
    { emailRedirectTo: 'http://localhost:3000/auth/callback?next=%2Fconta' },
  );
});
