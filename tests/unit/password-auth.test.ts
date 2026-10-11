import { beforeEach, expect, test, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { emailLoginSchema, emailSignupSchema, newPasswordSchema } from '@/lib/validation/schemas';
import { authError } from '@/lib/auth-errors';

const mocks = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    getUser: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    verifyOtp: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  },
  rpc: vi.fn(),
  client: vi.fn(),
  configured: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ supabase: mocks.client }));
vi.mock('@/lib/env', () => ({
  configured: mocks.configured,
  appUrl: () => 'http://localhost:3000',
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('next/navigation', () => ({
  redirect: (target: string) => {
    throw new Error('REDIRECT:' + target);
  },
}));
import {
  loginWithEmail,
  signupWithEmail,
  requestPasswordReset,
  updatePassword,
} from '@/server/password-auth';

const password = 'Minha senha de teste 123!';
function form(fields: Record<string, string>) {
  const result = new FormData();
  for (const [key, value] of Object.entries(fields)) result.set(key, value);
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.client.mockResolvedValue({ auth: mocks.auth, rpc: mocks.rpc });
  mocks.rpc.mockResolvedValue({ data: null, error: null });
  mocks.auth.signOut.mockResolvedValue({ error: null });
});

test('normaliza e-mail, preserva senha e valida confirmação no servidor', () => {
  expect(emailLoginSchema.parse({ email: ' Pessoa@Example.com ', password: ' senha ' })).toEqual({
    email: 'pessoa@example.com',
    password: ' senha ',
  });
  expect(
    emailSignupSchema.safeParse({ email: 'invalido', password, passwordConfirmation: password })
      .success,
  ).toBe(false);
  expect(
    newPasswordSchema.safeParse({ password: 'curta', passwordConfirmation: 'curta' }).success,
  ).toBe(false);
  expect(
    newPasswordSchema.safeParse({ password, passwordConfirmation: password + 'x' }).success,
  ).toBe(false);
});
test('cadastro com confirmação divergente não chama Supabase e não devolve senha', async () => {
  const result = await signupWithEmail(
    {},
    form({ email: 'pessoa@example.com', password, passwordConfirmation: password + 'x' }),
  );
  expect(result.error).toBe('As senhas precisam ser iguais.');
  expect(mocks.client).not.toHaveBeenCalled();
  expect(JSON.stringify(result)).not.toContain(password);
});
test('credenciais incorretas usam erro genérico sem registrar login', async () => {
  mocks.auth.signInWithPassword.mockResolvedValue({
    data: {},
    error: { code: 'invalid_credentials', message: 'pessoa@example.com does not exist' },
  });
  expect(await loginWithEmail({}, form({ email: 'pessoa@example.com', password }))).toEqual({
    error: 'E-mail ou senha incorretos.',
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test('login válido usa credenciais, registra login e redireciona para regras normais', async () => {
  mocks.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'identity' }, session: { access_token: 'token' } },
    error: null,
  });
  await expect(loginWithEmail({}, form({ email: 'pessoa@example.com', password }))).rejects.toThrow(
    'REDIRECT:/app',
  );
  expect(mocks.auth.signInWithPassword).toHaveBeenCalledWith({
    email: 'pessoa@example.com',
    password,
  });
  expect(mocks.rpc).toHaveBeenCalledWith('log_login');
});
test('login e callback preservam pedido interno e rejeitam destino externo', async () => {
  const target = '/pedidos/00000000-0000-0000-0000-000000000001';
  mocks.auth.signInWithPassword.mockResolvedValue({
    data: { user: { id: 'identity' }, session: {} },
    error: null,
  });
  await expect(
    loginWithEmail({}, form({ email: 'pessoa@example.com', password, next: target })),
  ).rejects.toThrow('REDIRECT:' + target);
  const { GET } = await import('@/app/auth/callback/route');
  mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const result = await GET(
    new NextRequest(
      'http://localhost:3000/auth/callback?code=valid&next=' + encodeURIComponent(target),
    ),
  );
  expect(result.headers.get('location')).toBe('http://localhost:3000' + target);
  await expect(
    loginWithEmail({}, form({ email: 'pessoa@example.com', password, next: '//evil.example' })),
  ).rejects.toThrow('REDIRECT:/app');
});
test('cadastro pendente respeita confirmação e não cria sessão nem registra login', async () => {
  mocks.auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
  const result = await signupWithEmail(
    {},
    form({ email: 'pessoa@example.com', password, passwordConfirmation: password }),
  );
  expect(result.success).toContain('Confira seu e-mail');
  expect(mocks.auth.signUp).toHaveBeenCalledWith({
    email: 'pessoa@example.com',
    password,
    options: { emailRedirectTo: 'http://localhost:3000/auth/callback' },
  });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test('cadastro existente tem a mesma resposta de cadastro pendente', async () => {
  const data = form({ email: 'pessoa@example.com', password, passwordConfirmation: password });
  mocks.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null });
  const pending = await signupWithEmail({}, data);
  mocks.auth.signUp.mockResolvedValueOnce({
    data: {},
    error: { code: 'user_already_exists', message: 'User exists' },
  });
  expect(await signupWithEmail({}, data)).toEqual(pending);
});
test('cadastro com sessão só entra quando o próprio Supabase fornece essa sessão', async () => {
  mocks.auth.signUp.mockResolvedValue({
    data: { session: { access_token: 'token' } },
    error: null,
  });
  await expect(
    signupWithEmail(
      {},
      form({ email: 'pessoa@example.com', password, passwordConfirmation: password }),
    ),
  ).rejects.toThrow('REDIRECT:/app');
});
test('recuperação não informa existência da conta e usa callback fixo', async () => {
  mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  const result = await requestPasswordReset(
    {},
    form({ email: 'pessoa@example.com', redirectTo: 'https://evil.example' }),
  );
  expect(result.success).toContain('Se houver uma conta');
  expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith('pessoa@example.com', {
    redirectTo: 'http://localhost:3000/auth/callback?destino=senha',
  });
});
test('troca de senha exige getUser válido antes de alterar a conta', async () => {
  mocks.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect(
    (await updatePassword({}, form({ password, passwordConfirmation: password }))).error,
  ).toContain('expirou');
  expect(mocks.auth.updateUser).not.toHaveBeenCalled();
});
test('troca autenticada ignora identidade forjada, encerra sessão e pede novo login', async () => {
  mocks.auth.getUser.mockResolvedValue({ data: { user: { id: 'identity' } }, error: null });
  mocks.auth.updateUser.mockResolvedValue({ error: null });
  await expect(
    updatePassword({}, form({ password, passwordConfirmation: password, user_id: 'another-user' })),
  ).rejects.toThrow('REDIRECT:/entrar?motivo=senha_atualizada');
  expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password });
  expect(mocks.auth.signOut).toHaveBeenCalled();
});
test('limites, confirmação e erros desconhecidos não revelam resposta do provedor', () => {
  expect(authError({ status: 429, message: 'secret' }).error).toContain('muitas tentativas');
  expect(authError({ code: 'email_not_confirmed', message: 'secret' }).error).toContain(
    'Confirme seu e-mail',
  );
  expect(authError({ message: 'secret@example.com private token' }).error).not.toContain('secret');
});
test('configuração ausente retorna erro claro sem executar autenticação', async () => {
  mocks.configured.mockReturnValue(false);
  expect(
    (await loginWithEmail({}, form({ email: 'pessoa@example.com', password }))).error,
  ).toContain('configurado');
  expect(mocks.client).not.toHaveBeenCalled();
});

test('callback de confirmação rejeita tipos e tokens inválidos sem chamar o provedor', async () => {
  const { GET } = await import('@/app/auth/confirm/route');
  const response = await GET(
    new NextRequest('http://localhost:3000/auth/confirm?type=invite&token_hash=' + 'a'.repeat(64)),
  );
  expect(response.headers.get('location')).toBe(
    'http://localhost:3000/entrar?motivo=link_expirado',
  );
  const malformed = await GET(
    new NextRequest('http://localhost:3000/auth/confirm?type=email&token_hash=curto'),
  );
  expect(malformed.headers.get('location')).toContain('motivo=link_expirado');
  expect(mocks.auth.verifyOtp).not.toHaveBeenCalled();
});
test('OTP validado pelo Supabase usa propósito e destino fixos mesmo com next externo', async () => {
  const { GET } = await import('@/app/auth/confirm/route');
  mocks.auth.verifyOtp.mockResolvedValue({ error: null });
  const token = 'a'.repeat(64);
  const response = await GET(
    new NextRequest(
      'http://localhost:3000/auth/confirm?type=email&token_hash=' +
        token +
        '&next=https://evil.example',
    ),
  );
  expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ type: 'email', token_hash: token });
  expect(response.headers.get('location')).toBe('http://localhost:3000/app');
  const recovery = await GET(
    new NextRequest('http://localhost:3000/auth/confirm?type=recovery&token_hash=' + token),
  );
  expect(recovery.headers.get('location')).toBe('http://localhost:3000/nova-senha');
});
test('OTP rejeitado não registra login nem libera atualização de senha', async () => {
  const { GET } = await import('@/app/auth/confirm/route');
  mocks.auth.verifyOtp.mockResolvedValue({ error: { code: 'otp_expired' } });
  const response = await GET(
    new NextRequest(
      'http://localhost:3000/auth/confirm?type=recovery&token_hash=' + 'a'.repeat(64),
    ),
  );
  expect(response.headers.get('location')).toBe(
    'http://localhost:3000/recuperar-senha?motivo=link_expirado',
  );
  expect(mocks.rpc).not.toHaveBeenCalled();
});
test('callback PKCE verifica o código e só aceita o destino interno de recuperação', async () => {
  const { GET } = await import('@/app/auth/callback/route');
  mocks.auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  const response = await GET(
    new NextRequest(
      'http://localhost:3000/auth/callback?code=validated-code&destino=senha&next=https://evil.example',
    ),
  );
  expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith('validated-code');
  expect(response.headers.get('location')).toBe('http://localhost:3000/nova-senha');
  const normal = await GET(
    new NextRequest(
      'http://localhost:3000/auth/callback?code=validated-code&destino=https://evil.example',
    ),
  );
  expect(normal.headers.get('location')).toBe('http://localhost:3000/app');
});
