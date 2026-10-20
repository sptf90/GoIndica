import { beforeAll, afterAll, test, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
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
import { cleanupExpired } from '@/server/cleanup';
let fixture: Awaited<ReturnType<typeof testDatabase>>;
let ana: DatabaseClient, joao: DatabaseClient, maria: DatabaseClient, admin: DatabaseClient;
const city = 3549805;
const ids = {
  ana: randomUUID(),
  joao: randomUUID(),
  maria: randomUUID(),
  admin: randomUUID(),
};
beforeAll(async () => {
  fixture = await testDatabase();
  Object.assign(process.env, fixture.env, {
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  });
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
  expect(await indicate(joao, ids.joao, request, place)).toMatchObject({
    error: null,
  });
  expect(await indicate(maria, ids.maria, request, place)).toMatchObject({
    error: null,
  });
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
      await ana.call('edit_request_with_photo', {
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
  expect(check(await joao.call('profile_stats')).points).toBe(10);
  expect(check(await maria.call('profile_stats')).points).toBe(10);
  await expect(
    fixture.pool.execute('UPDATE reward_events SET points=20 WHERE request_id=?', [request]),
  ).rejects.toThrow('IMMUTABLE_LEDGER');
  expect(
    (
      await ana.call('resolve_request', {
        p_request_id: request,
        p_type: 'NOT_FOUND',
      })
    ).error?.message,
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
    (
      await joao.call('admin_moderate', {
        p_action: 'BLOCK_USER',
        p_target_id: ids.ana,
      })
    ).error?.message,
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
      check(
        await joao.call('search_requests', {
          p_city_id: city,
          p_query: '',
          p_offset: 0,
        }),
      ),
    ).toBeInstanceOf(Array);
    expect(connection).not.toHaveBeenCalled();
    await fixture.pool.execute('UPDATE accounts SET blocked=TRUE WHERE id=?', [ids.joao]);
    for (const name of ['account_state', 'member_summary'] as const)
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
      const result = await joao.call(name, {
        p_city_id: city,
        p_query: '',
        p_offset: 0,
      });
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
    (
      await auth.signInWithPassword({
        email,
        password: 'Outra senha longa segura 456!',
      })
    ).error,
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
async function person(username: string) {
  const id = randomUUID();
  await fixture.pool.execute(
    'INSERT INTO users(id,email,password_hash,email_confirmed_at) VALUES(?,?,?,UTC_TIMESTAMP(3))',
    [id, username + '@test.invalid', 'sem-login'],
  );
  await fixture.pool.execute('INSERT INTO accounts(id) VALUES(?)', [id]);
  await fixture.pool.execute(
    'INSERT INTO profiles(id,username,display_name,home_city_id) VALUES(?,?,?,?)',
    [id, username, 'Pessoa ' + username, city],
  );
  return { id, username, db: new DatabaseClient(false, { id, admin: false }) };
}
const saveProfile = (db: DatabaseClient, username: string, cityId = city, photo?: string) =>
  db.call('save_profile', {
    p_username: username,
    p_display_name: 'Pessoa ' + username,
    p_city_id: cityId,
    p_photo: photo,
  });
test('nome de usuário é único, com erro próprio, inclusive em gravações simultâneas', async () => {
  const first = await person('nome_unico_a'),
    second = await person('nome_unico_b');
  expect((await saveProfile(second.db, 'nome_unico_a')).error?.message).toBe('USERNAME_TAKEN');
  expect((await saveProfile(second.db, 'NOME_UNICO_A')).error?.message).toBe('USERNAME_TAKEN');
  expect(
    check(
      await second.db.call('username_available', {
        p_username: 'nome_unico_a',
      }),
    ),
  ).toBe(false);
  expect(check(await first.db.call('username_available', { p_username: 'nome_unico_a' }))).toBe(
    true,
  );
  expect(check(await second.db.call('username_available', { p_username: 'nome_livre' }))).toBe(
    true,
  );
  const third = await person('disputa_c'),
    fourth = await person('disputa_d');
  const outcomes = await Promise.all([
    saveProfile(third.db, 'nome_disputado'),
    saveProfile(fourth.db, 'nome_disputado'),
  ]);
  const errors = outcomes.map((o) => o.error?.message ?? 'OK');
  expect(errors.sort()).toEqual(['OK', 'USERNAME_TAKEN']);
  const [owners] = await fixture.pool.execute<import('mysql2').RowDataPacket[]>(
    "SELECT COUNT(*) AS total FROM profiles WHERE username='nome_disputado'",
  );
  expect(Number(owners[0].total)).toBe(1);
});
test('trocar a cidade do perfil não altera pedidos anteriores', async () => {
  const author = await person('cidade_autor');
  const request = check(
    await author.db.call('create_request_with_photo', {
      p_city_id: city,
      p_description: 'Onde consertar bicicleta?',
    }),
  );
  check(await saveProfile(author.db, 'cidade_autor', 3550308));
  expect(
    check(await author.db.from('profiles').select('*').eq('id', author.id).single()).home_city_id,
  ).toBe(3550308);
  expect(
    check(await author.db.from('requests').select('*').eq('id', request).single()).city_id,
  ).toBe(city);
});
test('perfil e foto só abrem a partir de conteúdo que a pessoa pode ver', async () => {
  const author = await person('contexto_autor'),
    helper = await person('contexto_ajuda'),
    viewer = await person('contexto_leitor');
  const jpeg = await sharp({
    create: { width: 8, height: 8, channels: 3, background: '#ec5e27' },
  })
    .jpeg()
    .toBuffer();
  check(await saveProfile(author.db, author.username, city, jpeg.toString('base64')));
  check(await saveProfile(helper.db, helper.username, city, jpeg.toString('base64')));
  const request = check(
    await author.db.call('create_request_with_photo', {
      p_city_id: city,
      p_description: 'Onde comprar pão de fermentação natural?',
    }),
  );
  const open = (db: DatabaseClient, username: string, context: object = {}) =>
    db.call('public_profile', { p_username: username, ...context }).then(check);
  const photo = (db: DatabaseClient, id: string, context: object = {}) =>
    db.call('profile_photo', { p_profile_id: id, ...context }).then(check);
  // Sem origem não há navegação livre, nem para nomes existentes.
  expect(await open(viewer.db, author.username)).toBeNull();
  expect(await photo(viewer.db, author.id)).toBeNull();
  // O autor aparece no pedido visível; o perfil traz só nome, foto, cidade e reputação.
  const shown = await open(viewer.db, author.username, {
    p_request_id: request,
  });
  expect(shown).toEqual({
    id: author.id,
    username: author.username,
    display_name: 'Pessoa ' + author.username,
    home_city_id: city,
    photo_updated_at: expect.any(String),
    reputation: 'Sem selo ainda',
  });
  expect(await photo(viewer.db, author.id, { p_request_id: request })).toBe(
    jpeg.toString('base64'),
  );
  // Quem indicou só é alcançável pelo dono do pedido, e só depois da revelação.
  const place = await registerPlace(helper.id, city, 'Padaria Natural', 'Rua do Trigo, 10');
  check(await indicate(helper.db, helper.id, request, place));
  expect(await open(author.db, helper.username, { p_request_id: request })).toBeNull();
  check(await author.db.call('reveal_responses', { p_request_id: request }));
  expect(await open(author.db, helper.username, { p_request_id: request })).not.toBeNull();
  expect(await photo(author.db, helper.id, { p_request_id: request })).not.toBeNull();
  expect(await open(viewer.db, helper.username, { p_request_id: request })).toBeNull();
  expect(await photo(viewer.db, helper.id, { p_request_id: request })).toBeNull();
  // Abrir o perfil não libera as indicações de terceiros.
  expect(
    check(await viewer.db.from('indications').select('*').eq('request_id', request)),
  ).toHaveLength(0);
  expect(
    (await viewer.db.call('indication_groups', { p_request_id: request })).error?.message,
  ).toBe('NOT_ALLOWED');
  // Ranking da cidade é origem válida apenas para quem pontuou nela.
  expect(await open(viewer.db, 'joao_teste', { p_ranking_city_id: city })).not.toBeNull();
  expect(await open(viewer.db, 'joao_teste', { p_ranking_city_id: 3550308 })).toBeNull();
  expect(await open(viewer.db, author.username, { p_ranking_city_id: city })).toBeNull();
  // O próprio perfil e a administração não dependem de origem.
  expect(await open(author.db, author.username)).not.toBeNull();
  expect(await open(admin, author.username)).not.toBeNull();
  // Pedido removido deixa de ser origem.
  check(
    await admin.call('admin_moderate', {
      p_action: 'HIDE_REQUEST',
      p_target_id: request,
      p_note: 'Remoção de teste autorizada',
    }),
  );
  expect(await open(viewer.db, author.username, { p_request_id: request })).toBeNull();
});
test('estatísticas detalhadas são só do titular e o ranking público é anônimo', async () => {
  const anonymous = new DatabaseClient();
  expect((await anonymous.call('profile_stats')).error?.message).toBe('AUTH_REQUIRED');
  expect((await anonymous.call('city_ranking', { p_city_id: city })).error?.message).toBe(
    'AUTH_REQUIRED',
  );
  const preview = check(await anonymous.call('public_city_ranking', { p_city_id: city }));
  expect(preview.length).toBeGreaterThan(0);
  expect(Object.keys(preview[0]).sort()).toEqual(['points', 'position']);
  expect(check(await joao.call('profile_stats')).points).toBe(10);
});
test('hashes de senha são verificados sem truncar senhas longas', async () => {
  const long = '123!'.repeat(30);
  const hash = await hashPassword(long);
  expect(await verifyPassword(long, hash)).toBe(true);
  expect(await verifyPassword(long + 'x', hash)).toBe(false);
});
test('limpeza do cron remove só sessões, tokens e contadores expirados', async () => {
  const sql = (q: string, v: (string | number)[] = []) => fixture.pool.execute(q, v);
  for (const [token, offset] of [
    ['a'.repeat(64), -1],
    ['b'.repeat(64), 1],
  ] as const) {
    await sql(
      'INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? HOUR))',
      [token, ids.ana, offset],
    );
    await sql(
      "INSERT INTO auth_tokens(token_hash,user_id,purpose,expires_at) VALUES(?,?,'email',DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? HOUR))",
      [token, ids.ana, offset],
    );
  }
  await sql(
    "INSERT INTO rate_limits(actor_id,bucket,window_start,hits) VALUES('limpeza','antigo',DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 3 DAY),1),('limpeza','atual',UTC_TIMESTAMP(3),1)",
  );
  const cleaned = await cleanupExpired();
  expect(cleaned.sessions).toBeGreaterThanOrEqual(1);
  expect(cleaned.tokens).toBeGreaterThanOrEqual(1);
  expect(cleaned.rate_limits).toBeGreaterThanOrEqual(1);
  const [left] = await fixture.pool.query(
    "SELECT (SELECT COUNT(*) FROM sessions WHERE token_hash IN (?,?)) s, (SELECT COUNT(*) FROM auth_tokens WHERE token_hash IN (?,?)) t, (SELECT GROUP_CONCAT(bucket) FROM rate_limits WHERE actor_id='limpeza') r",
    ['a'.repeat(64), 'b'.repeat(64), 'a'.repeat(64), 'b'.repeat(64)],
  );
  expect(left).toEqual([{ s: 1, t: 1, r: 'atual' }]);
});
async function select<T = Record<string, unknown>>(
  query: string,
  values: (string | number)[] = [],
) {
  const [result] = await fixture.pool.query(query, values);
  return result as T[];
}
const receita = {
  cnpj: '19131243000197',
  legalName: 'OPEN KNOWLEDGE BRASIL',
  tradeName: 'REDE PELO CONHECIMENTO LIVRE',
  registrationStatus: 'ATIVA',
  cityId: city,
  branch: 'MATRIZ' as const,
};
const business = (cnpj: string, displayName = 'Rede Livre') => ({
  cnpj,
  displayName,
  legalName: '',
  data: { ...receita, cnpj },
});
test('empresa se cadastra por CNPJ e nunca ganha perfil, pedidos ou indicações', async () => {
  browser.cookies.clear();
  mail.send.mockClear();
  const auth = new LocalAuth();
  const email = 'empresa@test.invalid',
    password = 'Senha da empresa longa 123!';
  expect(
    (await auth.signUp({ email, password, next: '/empresa', company: business(receita.cnpj) }))
      .error,
  ).toBeNull();
  const url = new URL(String(mail.send.mock.calls.at(-1)?.[2]).match(/http:\/\/[^\s]+/)![0]);
  expect(url.searchParams.get('next')).toBe('/empresa');
  expect(
    (await auth.verifyOtp({ type: 'email', token_hash: url.searchParams.get('token_hash')! }))
      .error,
  ).toBeNull();
  const [row] = await select<{
    id: string;
    kind: string;
    data_source: string;
    legal_name: string;
    checked: number;
  }>(
    `SELECT a.id,a.kind,c.data_source,c.legal_name,c.data_checked_at IS NOT NULL AS checked FROM users u
    JOIN accounts a ON a.id=u.id JOIN companies c ON c.account_id=a.id WHERE u.email=?`,
    [email],
  );
  expect(row).toMatchObject({
    kind: 'company',
    data_source: 'RECEITA',
    legal_name: receita.legalName,
    checked: 1,
  });
  const businessDb = new DatabaseClient(false, { id: row.id, admin: false });
  expect(check(await businessDb.call('account_state'))).toEqual({
    admin: false,
    onboarded: false,
    kind: 'company',
  });
  // Sem perfil, todas as operações de membro são recusadas no servidor.
  expect(
    (
      await businessDb.call('create_request_with_photo', {
        p_city_id: city,
        p_description: 'Pedido de empresa',
      })
    ).error?.message,
  ).toBe('ONBOARDING_REQUIRED');
  const request = await create();
  const place = await registerPlace(ids.joao, city, 'Loja da Empresa', 'Rua Comercial, 1');
  expect((await indicate(businessDb, row.id, request, place)).error?.message).toBe(
    'ONBOARDING_REQUIRED',
  );
  expect((await businessDb.call('city_ranking', { p_city_id: city })).error?.message).toBe(
    'ONBOARDING_REQUIRED',
  );
  // E o banco segura as mesmas regras, mesmo sem passar pela aplicação.
  expect(
    (
      await businessDb.call('save_profile', {
        p_username: 'empresa_x',
        p_display_name: 'Empresa',
        p_city_id: city,
      })
    ).error?.message,
  ).toBe('NOT_ALLOWED');
  await expect(
    fixture.pool.execute(
      'INSERT INTO profiles(id,username,display_name,home_city_id) VALUES(?,?,?,?)',
      [row.id, 'empresa_y', 'Empresa', city],
    ),
  ).rejects.toThrow('NOT_ALLOWED');
  await expect(
    fixture.pool.execute("UPDATE accounts SET kind='member' WHERE id=?", [row.id]),
  ).rejects.toThrow('NOT_ALLOWED');
  await expect(
    fixture.pool.execute("UPDATE accounts SET kind='company' WHERE id=?", [ids.ana]),
  ).rejects.toThrow('NOT_ALLOWED');
  await expect(
    fixture.pool.execute(
      "INSERT INTO companies(account_id,cnpj,legal_name,display_name,data_source) VALUES(?,'00000000000272','Membro','Membro','MANUAL')",
      [ids.ana],
    ),
  ).rejects.toThrow('NOT_ALLOWED');
  // Nenhuma superfície pública ou de membro lista a empresa; só o admin a enxerga.
  expect(
    check(await ana.call('city_ranking', { p_city_id: city })).some((r) => r.id === row.id),
  ).toBe(false);
  const accounts = check(await admin.call('admin_accounts', { p_search: '19.131.243/0001-97' }));
  expect(accounts).toEqual([
    expect.objectContaining({
      id: row.id,
      kind: 'company',
      company_name: 'Rede Livre',
      username: null,
    }),
  ]);
  await auth.signOut();
});
test('CNPJ não gera cadastro duplicado, nem em envios simultâneos', async () => {
  const { cnpjTaken } = await import('@/lib/company');
  const cnpj = '00000000000272',
    password = 'Senha da empresa longa 123!';
  const outcomes = await Promise.all(
    ['filial-a@test.invalid', 'filial-b@test.invalid'].map((email) =>
      new LocalAuth().signUp({ email, password, company: business(cnpj, 'Filial') }),
    ),
  );
  expect(outcomes.map((o) => o.error?.message || 'OK').sort()).toEqual(['CNPJ_TAKEN', 'OK']);
  expect(await cnpjTaken(cnpj)).toBe(true);
  const [{ total }] = await select<{ total: number }>(
    'SELECT COUNT(*) total FROM companies WHERE cnpj=?',
    [cnpj],
  );
  expect(Number(total)).toBe(1);
  // Um cadastro que não confirmou o e-mail em 24 horas libera o CNPJ para o estabelecimento.
  await select(
    'UPDATE users u JOIN companies c ON c.account_id=u.id SET u.created_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 2 DAY) WHERE c.cnpj=?',
    [cnpj],
  );
  expect(await cnpjTaken(cnpj)).toBe(false);
  expect(
    (
      await new LocalAuth().signUp({
        email: 'filial-c@test.invalid',
        password,
        company: business(cnpj, 'Filial certa'),
      })
    ).error,
  ).toBeNull();
  expect(
    await select(
      'SELECT u.email FROM companies c JOIN users u ON u.id=c.account_id WHERE c.cnpj=?',
      [cnpj],
    ),
  ).toEqual([{ email: 'filial-c@test.invalid' }]);
});
test('consulta de CNPJ guarda só dados do estabelecimento e usa cache', async () => {
  const { lookupCnpj } = await import('@/lib/company');
  process.env.CNPJ_API_URL = 'http://cnpj.test/api/, http://reserva.test/';
  const fetcher = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async (url) => {
    const cnpj = url.split('/').at(-1);
    if (url.startsWith('http://reserva.test/'))
      return cnpj === '11444777000161'
        ? Response.json({
            razao_social: 'MERCADO RESERVA LTDA',
            descricao_situacao_cadastral: 'ATIVA',
          })
        : new Response('falha', { status: 502 });
    if (cnpj === '12ABC34501DE35')
      return Response.json({
        razao_social: 'MERCADO  ALFA   LTDA',
        nome_fantasia: '',
        descricao_situacao_cadastral: 'ATIVA',
        codigo_municipio_ibge: city,
        descricao_identificador_matriz_filial: 'FILIAL',
        qsa: [{ nome_socio: 'PESSOA SOCIA', cnpj_cpf_do_socio: '***123***' }],
      });
    if (cnpj === '19131243000197') return new Response('{}', { status: 404 });
    return new Response('{"error":"Forbidden"}', { status: 403 });
  });
  vi.stubGlobal('fetch', fetcher);
  try {
    expect(await lookupCnpj('12ABC34501DE35')).toEqual({
      status: 'found',
      data: {
        cnpj: '12ABC34501DE35',
        legalName: 'MERCADO ALFA LTDA',
        tradeName: null,
        registrationStatus: 'ATIVA',
        cityId: city,
        branch: 'FILIAL',
      },
    });
    expect(await lookupCnpj('12ABC34501DE35')).toMatchObject({ status: 'found' });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get('User-Agent')).toMatch(/^GoIndica/);
    const [cached] = await select<Record<string, unknown>>(
      'SELECT * FROM cnpj_lookups WHERE cnpj=?',
      ['12ABC34501DE35'],
    );
    expect(JSON.stringify(cached)).not.toContain('SOCIA');
    expect(await lookupCnpj('19131243000197', true)).toEqual({ status: 'not_found' });
    expect(await lookupCnpj('11444777000161', true)).toMatchObject({
      status: 'found',
      data: { legalName: 'MERCADO RESERVA LTDA', registrationStatus: 'ATIVA' },
    });
    expect(await lookupCnpj('00000000000272', true)).toEqual({ status: 'unavailable' });
    expect(await select('SELECT cnpj FROM cnpj_lookups WHERE cnpj=?', ['00000000000272'])).toEqual(
      [],
    );
  } finally {
    vi.unstubAllGlobals();
    delete process.env.CNPJ_API_URL;
  }
});
