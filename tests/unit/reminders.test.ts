import { beforeEach, afterEach, test, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), get: vi.fn(), log: vi.fn(), fetch: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({
  serviceClient: () => ({ rpc: mocks.rpc, auth: { admin: { getUserById: mocks.get } } }),
}));
vi.mock('@/lib/observability', () => ({ operationalError: mocks.log }));
vi.mock('@/lib/env', () => ({
  requiredEnv: (name: string) =>
    name === 'EMAIL_FROM' ? 'GoIndica <mail@test.invalid>' : 'test-key',
  appUrl: () => 'https://app.test.invalid',
}));
import { runReminders } from '@/server/reminders';
const job = { id: 'job-1', user_id: 'user-1', request_id: 'request-1' };
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mocks.fetch);
  mocks.fetch.mockResolvedValue(new Response('{}', { status: 200 }));
  mocks.get.mockResolvedValue({ data: { user: { email: 'member@test.invalid' } }, error: null });
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'prepare_reminders'
        ? 1
        : name === 'claim_email_jobs'
          ? [job]
          : name === 'email_job_eligible'
            ? true
            : null,
    error: null,
  }));
});
afterEach(() => vi.unstubAllGlobals());
test('mensagem usa chave estável, link do pedido e preferência, sem autores nem locais', async () => {
  expect(await runReminders()).toEqual({ prepared: 1, sent: 1, failed: 0 });
  const options = mocks.fetch.mock.calls[0][1];
  expect(options.headers['Idempotency-Key']).toBe('reminder/job-1');
  expect(JSON.parse(options.body).text).toContain('/pedidos/request-1');
  expect(JSON.parse(options.body).text).toContain('/preferencias');
  expect(options.body).not.toContain('place');
  expect(mocks.rpc).toHaveBeenCalledWith(
    'finish_email_job',
    expect.objectContaining({ p_id: job.id, p_sent: true }),
  );
});
test('cancelamento do consentimento antes do envio impede chamada ao provedor', async () => {
  mocks.rpc.mockImplementation(async (name: string) => ({
    data:
      name === 'prepare_reminders'
        ? 0
        : name === 'claim_email_jobs'
          ? [job]
          : name === 'email_job_eligible'
            ? false
            : null,
    error: null,
  }));
  expect((await runReminders()).sent).toBe(0);
  expect(mocks.fetch).not.toHaveBeenCalled();
});
test('erro de entrega deixa tentativa para a fila e registra falha sanitizada', async () => {
  mocks.fetch.mockRejectedValue(new Error('sensitive provider message'));
  expect(await runReminders()).toEqual({ prepared: 1, sent: 0, failed: 1 });
  expect(mocks.rpc).toHaveBeenCalledWith(
    'finish_email_job',
    expect.objectContaining({ p_sent: false }),
  );
  expect(mocks.log).toHaveBeenCalledWith('reminders.delivery', expect.any(Error));
});
