import { beforeAll, afterAll, test, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database';
const browser = vi.hoisted(() => ({ cookies: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '127.0.0.1' }),
  cookies: async () => ({
    get: (key: string) =>
      browser.cookies.has(key) ? { value: browser.cookies.get(key) } : undefined,
    set: (key: string, value: string) => browser.cookies.set(key, value),
    delete: (key: string) => browser.cookies.delete(key),
  }),
}));
const mail = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/lib/mail/smtp', () => ({ sendMail: mail.send }));
import { DatabaseClient } from '@/lib/database/client';
import { pool } from '@/lib/database/pool';
import { registerPlace } from '@/lib/places';
import { LocalAuth } from '@/lib/auth/service';
import { hashPassword, verifyPassword } from '@/lib/auth/crypto';
import { check } from '@/lib/errors';
import * as reads from '@/lib/database/read-operations';
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let ana: DatabaseClient, joao: DatabaseClient, maria: DatabaseClient, admin: DatabaseClient;
const city = 3549805;
const ids = { ana: randomUUID(), joao: randomUUID(), maria: randomUUID(), admin: randomUUID() };
beforeAll(async () => {
  fixture = await testDatabase();
  Object.assign(process.env, fixture.env, { NEXT_PUBLIC_APP_URL: 'http://localhost:3000' });
  for (const [name, id] of Object.entries(ids)) {
    await fixture.pool.execute(
      'INSERT INTO users(id,email,password_hash,email_confirmed_at) VALUES(?,?,?,UTC_TIMESTAMP(3))',
      [id, name + '@test.invalid', await hashPassword('Senha longa de teste 123!')],
    );
    await fixture.pool.execute('INSERT INTO accounts(id,is_admin) VALUES(?,?)', [
      id,
      name === 'admin',
    ]);
    await fixture.pool.execute(
      'INSERT INTO profiles(id,username,display_name,home_city_id) VALUES(?,?,?,?)',
      [id, name + '_teste', name, city],
    );
  }
  ana = new DatabaseClient(false, { id: ids.ana, admin: false });
  joao = new DatabaseClient(false, { id: ids.joao, admin: false });
  maria = new DatabaseClient(false, { id: ids.maria, admin: false });
  admin = new DatabaseClient(false, { id: ids.admin, admin: true });
});
afterAll(async () => {
  if (!fixture) return;
  await pool().end();
  (globalThis as typeof globalThis & { goindicaPool?: unknown }).goindicaPool = undefined;
  await fixture?.close();
});
const create = async () =>
  check(
    await ana.call('create_request_with_photo', {
      p_city_id: city,
      p_description: 'Onde encontro café especial?',
    }),
  );
async function indicate(client: DatabaseClient, user: string, request: string, place: string) {
  return client.call('submit_verified_indication', {
    p_actor: user,
    p_request_id: request,
    p_place_id: place,
    p_verified_city_id: city,
    p_comment: 'Comprei neste local recentemente.',
  });
}
test('catálogo inteiro e busca de municípios funcionam no MySQL', async () => {
  const [rows] = await fixture.pool.query<import('mysql2').RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM cities',
  );
  expect(Number(rows[0].total)).toBe(5571);
  const cities = check(
    await ana.from('cities').select('*').ilike('normalized_name', '%sao jose do rio preto%'),
  );
  expect(cities[0].id).toBe(city);
});
test('indicações privadas, revelação definitiva e pontos sem duplicação sob concorrência', async () => {
  const request = await create(),
    place = await registerPlace(ids.joao, city, 'Empório do Centro', 'Rua Central, 123, Centro');
  expect((await indicate(ana, ids.ana, request, place)).error?.message).toBe('SELF_INDICATION');
  expect(await indicate(joao, ids.joao, request, place)).toMatchObject({ error: null });
  expect(await indicate(maria, ids.maria, request, place)).toMatchObject({ error: null });
  expect(check(await ana.from('indications').select('*').eq('request_id', request))).toHaveLength(
    0,
  );
  expect(check(await joao.from('indications').select('*').eq('request_id', request))).toHaveLength(
    1,
  );
  expect((await ana.call('indication_groups', { p_request_id: request })).error?.message).toBe(
    'NOT_ALLOWED',
  );
  expect(
    (
      await ana.call('edit_request', {
        p_request_id: request,
        p_description: 'Texto alterado',
        p_city_id: city,
      })
    ).error?.message,
  ).toBe('EDIT_LOCKED');
  expect(await ana.call('reveal_responses', { p_request_id: request })).toMatchObject({
    error: null,
  });
  expect(check(await ana.call('indication_groups', { p_request_id: request }))[0].indications).toBe(
    2,
  );
  const outcomes = await Promise.all([
    ana.call('resolve_request', {
      p_request_id: request,
      p_type: 'INDICATED_PLACE',
      p_place_id: place,
    }),
    ana.call('resolve_request', {
      p_request_id: request,
      p_type: 'INDICATED_PLACE',
      p_place_id: place,
    }),
  ]);
  expect(outcomes.map((o) => o.error)).toEqual([null, null]);
  expect(outcomes[0].data).toBe(outcomes[1].data);
  expect(check(await joao.call('profile_stats', { p_username: 'joao_teste' })).points).toBe(10);
  expect(check(await maria.call('profile_stats', { p_username: 'maria_teste' })).points).toBe(10);
  await expect(
    fixture.pool.execute('UPDATE reward_events SET points=20 WHERE request_id=?', [request]),
  ).rejects.toThrow('IMMUTABLE_LEDGER');
  expect(
    (await ana.call('resolve_request', { p_request_id: request, p_type: 'NOT_FOUND' })).error
      ?.message,
  ).toBe('REQUEST_CLOSED');
  check(await joao.call('reconfirm_discovery', { p_request_id: request }));
  check(await joao.call('reconfirm_discovery', { p_request_id: request }));
  expect(
    check(await ana.from('requests').select('*').eq('id', request).single()).reconfirmation_count,
  ).toBe(1);
});
test('cancelamento concorre com indicação sem aceitar respostas em pedido fechado', async () => {
  const request = await create(),
    place = await registerPlace(ids.joao, city, 'Loja de Bairro', 'Rua do Bairro, 45');
  await Promise.all([
    ana.call('cancel_request', { p_request_id: request }),
    indicate(joao, ids.joao, request, place),
  ]);
  expect(check(await ana.from('requests').select('*').eq('id', request).single()).status).toBe(
    'CANCELED',
  );
  expect((await indicate(maria, ids.maria, request, place)).error?.message).toBe(
    'RESPONSES_LOCKED',
  );
});
test('foto e criação são atômicas; campos maliciosos não entram na consulta', async () => {
  const [before] = await fixture.pool.query<import('mysql2').RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM requests',
  );
  expect(
    (
      await ana.call('create_request_with_photo', {
        p_city_id: city,
        p_description: 'Pedido com foto inválida',
        p_photo: Buffer.from('invalid').toString('base64'),
      })
    ).error?.message,
  ).toBe('INVALID_PHOTO');
  const [after] = await fixture.pool.query<import('mysql2').RowDataPacket[]>(
    'SELECT COUNT(*) AS total FROM requests',
  );
  expect(after[0].total).toBe(before[0].total);
  expect(() => ana.from('requests').select('*').eq('id` OR 1=1 --', 'x')).toThrow('INVALID_INPUT');
});
test('cidades incompatíveis, identidades forjadas e operações administrativas são recusadas', async () => {
  const request = await create(),
    place = await registerPlace(ids.joao, 3550308, 'Loja de São Paulo', 'Rua Paulista, 23');
  expect((await indicate(joao, ids.joao, request, place)).error?.message).toBe('INVALID_CITY');
  expect((await indicate(joao, ids.ana, request, place)).error?.message).toBe('NOT_ALLOWED');
  expect(
    (await joao.call('admin_moderate', { p_action: 'BLOCK_USER', p_target_id: ids.ana })).error
      ?.message,
  ).toBe('NOT_ALLOWED');
  expect((await new DatabaseClient().from('requests').select('*')).error?.message).toBe(
    'AUTH_REQUIRED',
  );
});
test('leituras comuns dispensam transação e continuam exigindo conta e perfil ativos', async () => {
  const connection = vi.spyOn(pool(), 'getConnection');
  try {
    expect(check(await joao.call('account_state')).onboarded).toBe(true);
    expect(check(await joao.call('member_summary'))).toHaveProperty('unread');
    expect(
      check(await joao.call('search_requests', { p_city_id: city, p_query: '', p_offset: 0 })),
    ).toBeInstanceOf(Array);
    expect(connection).not.toHaveBeenCalled();
    await fixture.pool.execute('UPDATE accounts SET blocked=TRUE WHERE id=?', [ids.joao]);
    for (const name of ['account_state', 'is_admin', 'member_summary'] as const)
      expect((await joao.call(name)).error?.message).toBe('ACCOUNT_BLOCKED');
  } finally {
    connection.mockRestore();
    await fixture.pool.execute('UPDATE accounts SET blocked=FALSE WHERE id=?', [ids.joao]);
  }
  // A confirmed account that has not completed onboarding can inspect its state, not the feed.
  const id = randomUUID();
  await fixture.pool.execute('INSERT INTO users(id,email) VALUES(?,?)', [id, id + '@test.invalid']);
  await fixture.pool.execute('INSERT INTO accounts(id) VALUES(?)', [id]);
  const newcomer = new DatabaseClient(false, { id, admin: false });
  expect(check(await newcomer.call('account_state')).onboarded).toBe(false);
  expect((await newcomer.call('member_summary')).error?.message).toBe('ONBOARDING_REQUIRED');
});
test.each(['member_summary', 'search_requests', 'search_unanswered_requests'] as const)(
  'bloqueio entre validação e leitura de %s não expõe dados',
  async (name) => {
    const original = reads.readOperation;
    const read = vi.spyOn(reads, 'readOperation').mockImplementationOnce(async (...args) => {
      await fixture.pool.execute('UPDATE accounts SET blocked=TRUE WHERE id=?', [ids.joao]);
      return original(...args);
    });
    try {
      const result = await joao.call(name, { p_city_id: city, p_query: '', p_offset: 0 });
      if (name === 'member_summary') expect(result.error?.message).toBe('AUTH_REQUIRED');
      else expect(check(result)).toEqual([]);
      expect(read).toHaveBeenCalled();
    } finally {
      read.mockRestore();
      await fixture.pool.execute('UPDATE accounts SET blocked=FALSE WHERE id=?', [ids.joao]);
    }
  },
);
test('perda de administração após validação não revela pedidos ocultos na busca', async () => {
  const id = await create();
  await fixture.pool.execute('UPDATE requests SET hidden_at=UTC_TIMESTAMP(3) WHERE id=?', [id]);
  const args = { p_city_id: city, p_query: '', p_offset: 0 };
  expect(check(await admin.call('search_requests', args)).some((r) => r.id === id)).toBe(true);
  const original = reads.readOperation;
  const read = vi.spyOn(reads, 'readOperation').mockImplementationOnce(async (...params) => {
    await fixture.pool.execute('UPDATE accounts SET is_admin=FALSE WHERE id=?', [ids.admin]);
    return original(...params);
  });
  try {
    expect(check(await admin.call('search_requests', args))).toEqual([]);
  } finally {
    read.mockRestore();
    await fixture.pool.execute('UPDATE accounts SET is_admin=TRUE WHERE id=?', [ids.admin]);
  }
});
test('login, confirmação, token único e recuperação isolada das páginas de membro', async () => {
  browser.cookies.clear();
  mail.send.mockClear();
  const auth = new LocalAuth();
  const email = 'novo@test.invalid',
    password = 'Nova senha muito longa 123!';
  expect((await auth.signUp({ email, password })).error).toBeNull();
  expect(browser.cookies.size).toBe(0);
  expect((await auth.signInWithPassword({ email, password })).error?.code).toBe(
    'email_not_confirmed',
  );
  const message = String(mail.send.mock.calls.at(-1)?.[2]),
    url = new URL(message.match(/http:\/\/[^\s]+/)![0]);
  const token = url.searchParams.get('token_hash')!;
  expect((await auth.verifyOtp({ type: 'email', token_hash: token })).error).toBeNull();
  expect((await auth.verifyOtp({ type: 'email', token_hash: token })).error).toBeTruthy();
  await auth.signOut();
  expect((await auth.signInWithPassword({ email, password: 'senha errada' })).error?.code).toBe(
    'invalid_credentials',
  );
  expect((await auth.signInWithPassword({ email, password })).error).toBeNull();
  await auth.signOut();
  await auth.resetPasswordForEmail(email);
  const recovery = new URL(String(mail.send.mock.calls.at(-1)?.[2]).match(/http:\/\/[^\s]+/)![0]);
  expect(
    (
      await auth.verifyOtp({
        type: 'recovery',
        token_hash: recovery.searchParams.get('token_hash')!,
      })
    ).error,
  ).toBeNull();
  expect((await new DatabaseClient().call('account_state')).error?.message).toBe('AUTH_REQUIRED');
  expect((await auth.updateUser({ password: 'Outra senha longa segura 456!' })).error).toBeNull();
  await auth.signOut();
  expect((await auth.signInWithPassword({ email, password })).error?.code).toBe(
    'invalid_credentials',
  );
  expect(
    (await auth.signInWithPassword({ email, password: 'Outra senha longa segura 456!' })).error,
  ).toBeNull();
  await auth.signOut();
});
test('bloqueio invalida acesso e não revela conteúdo privado', async () => {
  check(
    await admin.call('admin_moderate', {
      p_action: 'BLOCK_USER',
      p_target_id: ids.maria,
      p_note: 'Bloqueio de teste autorizado',
    }),
  );
  expect((await maria.from('requests').select('*')).data).toEqual([]);
  expect((await maria.call('member_summary')).error?.message).toBe('ACCOUNT_BLOCKED');
  check(
    await admin.call('admin_moderate', {
      p_action: 'UNBLOCK_USER',
      p_target_id: ids.maria,
      p_note: 'Desbloqueio de teste autorizado',
    }),
  );
});
test('fechamento remove credenciais e informações pessoais, preservando recompensas', async () => {
  const support = check(
    await maria.call('request_support', {
      p_kind: 'CLOSE_ACCOUNT',
      p_reason: 'Quero encerrar minha conta de teste',
    }),
  );
  check(await admin.call('prepare_account_closure', { p_id: support }));
  check(
    await admin.call('complete_account_closure', {
      p_id: support,
      p_note: 'Encerramento autorizado pelo titular',
    }),
  );
  const [user] = await fixture.pool.execute<import('mysql2').RowDataPacket[]>(
    'SELECT email,password_hash,deleted_at FROM users WHERE id=?',
    [ids.maria],
  );
  expect(user[0].email).toBeNull();
  expect(user[0].password_hash).toBeNull();
  expect(user[0].deleted_at).toBeTruthy();
  const [reward] = await fixture.pool.execute<import('mysql2').RowDataPacket[]>(
    'SELECT SUM(points) AS points FROM reward_events WHERE user_id=?',
    [ids.maria],
  );
  expect(Number(reward[0].points)).toBe(10);
});
test('hashes novos e senhas antigas bcrypt são verificadas sem truncar as novas', async () => {
  const long = '123!'.repeat(30);
  const hash = await hashPassword(long);
  expect(await verifyPassword(long, hash)).toBe(true);
  expect(await verifyPassword(long + 'x', hash)).toBe(false);
  const { hash: legacyHash } = await import('bcryptjs');
  expect(await verifyPassword('senha antiga', await legacyHash('senha antiga', 4))).toBe(true);
});
