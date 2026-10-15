import { beforeAll, afterAll, beforeEach, test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase } from './database';
import { cityMigration } from '../../scripts/lib/cities-migration';
let db: Awaited<ReturnType<typeof testDatabase>>,
  owner: string,
  person: string,
  follower: string,
  admin: string,
  request: string;
const city = 3549805;
const rpc = (actor: string, sql: string, args: unknown[] = []) =>
  db.as('authenticated', actor, sql, args);
async function indicate(actor = person, req = request) {
  return db.as('service_role', null, 'select public.submit_verified_indication($1,$2,$3,$4,$5)', [
    actor,
    req,
    'place_test',
    city,
    'Texto pessoal do indicante',
  ]);
}
async function create(actor = owner) {
  return (
    await rpc(actor, "select public.create_request('Farinha especial Caputo', $1) id", [city])
  ).rows[0].id as string;
}
async function resolve(type = 'INDICATED_PLACE', req = request) {
  await rpc(owner, 'select public.reveal_responses($1)', [req]);
  const place =
    type === 'INDICATED_PLACE'
      ? (await db.pool.query('select id from public.places limit 1')).rows[0].id
      : null;
  await rpc(owner, 'select public.resolve_request($1,$2,$3)', [req, type, place]);
}
beforeAll(async () => {
  db = await testDatabase();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.pool.query(
    'truncate auth.users,private.rate_limits,private.analytics,private.public_rate_limits cascade',
  );
  [owner, person, follower, admin] = Array.from({ length: 4 }, () => randomUUID());
  for (const [index, id] of [owner, person, follower, admin].entries()) {
    await db.pool.query('insert into auth.users(id) values($1)', [id]);
    await rpc(id, 'select public.save_profile($1,$2,$3,false)', [
      'test_' + index,
      'Pessoa ' + index,
      city,
    ]);
  }
  await db.pool.query('update private.accounts set is_admin=true where id=$1', [admin]);
  request = await create();
});
test('notifica apenas destinatários, sem nomes nem locais antes da revelação', async () => {
  await rpc(follower, 'select public.set_request_interest($1,null,true)', [request]);
  await indicate();
  const rows = (await rpc(owner, 'select * from public.notifications')).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0].kind).toBe('INDICATION_RECEIVED');
  expect(rows[0]).not.toHaveProperty('place_id');
  expect(rows[0]).not.toHaveProperty('author_id');
  expect((await rpc(follower, 'select * from public.notifications')).rowCount).toBe(1);
  expect((await rpc(person, 'select * from public.notifications')).rowCount).toBe(0);
  expect((await rpc(follower, 'select * from public.indications')).rowCount).toBe(0);
  await expect(rpc(owner, 'update public.notifications set read_at=now()')).rejects.toThrow(
    'permission denied',
  );
  await rpc(person, 'select public.mark_notifications_read($1)', [rows[0].id]);
  expect((await rpc(owner, 'select public.member_summary() s')).rows[0].s.unread).toBe(1);
  await rpc(owner, 'select public.mark_notifications_read()');
  expect((await rpc(owner, 'select public.member_summary() s')).rows[0].s).toMatchObject({
    unread: 0,
    pending: 1,
  });
});
test('resultado e recompensa notificam o indicante e o seguidor uma única vez', async () => {
  await rpc(follower, 'select public.set_request_interest($1,true,true)', [request]);
  await indicate();
  await resolve();
  expect(
    (await rpc(person, 'select kind from public.notifications order by kind')).rows.map(
      (r) => r.kind,
    ),
  ).toEqual(['RESULT_RECORDED', 'REWARD_RECEIVED']);
  expect(
    (
      await rpc(
        follower,
        "select count(*)::int n from public.notifications where kind='RESULT_RECORDED'",
      )
    ).rows[0].n,
  ).toBe(1);
  await expect(resolve()).rejects.toThrow();
  expect((await db.pool.query('select count(*)::int n from public.reward_events')).rows[0].n).toBe(
    1,
  );
});
test('salvar e acompanhar são independentes e privados', async () => {
  await rpc(person, 'select public.set_request_interest($1,true,null)', [request]);
  await rpc(person, 'select public.set_request_interest($1,null,true)', [request]);
  await rpc(person, 'select public.set_request_interest($1,false,null)', [request]);
  expect((await rpc(person, 'select saved,following from public.request_interests')).rows).toEqual([
    { saved: false, following: true },
  ]);
  expect((await rpc(owner, 'select * from public.request_interests')).rowCount).toBe(0);
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [request]);
  expect((await rpc(person, 'select * from public.request_interests')).rowCount).toBe(0);
  await expect(
    rpc(person, 'select public.set_request_interest($1,true,true)', [request]),
  ).rejects.toThrow('NOT_ALLOWED');
});
test('cidades acompanhadas têm limite, remoção e isolamento por usuário', async () => {
  const ids = (await db.pool.query('select id from public.cities order by id limit 9')).rows.map(
    (r) => r.id,
  );
  for (const id of ids.slice(0, 8))
    await rpc(owner, 'select public.set_followed_city($1,true)', [id]);
  await expect(rpc(owner, 'select public.set_followed_city($1,true)', [ids[8]])).rejects.toThrow(
    'CITY_LIMIT',
  );
  await rpc(owner, 'select public.set_followed_city($1,false)', [ids[0]]);
  await rpc(owner, 'select public.set_followed_city($1,true)', [ids[8]]);
  expect((await rpc(owner, 'select * from public.followed_cities')).rowCount).toBe(8);
  expect((await rpc(person, 'select * from public.followed_cities')).rowCount).toBe(0);
});
test('métricas separam três resultados, ignoram cancelados e preservam liquidez histórica', async () => {
  await indicate();
  await resolve();
  const other = await create();
  await indicate(person, other);
  await resolve('OTHER_PLACE', other);
  const none = await create();
  await indicate(person, none);
  await resolve('NOT_FOUND', none);
  const canceled = await create();
  await rpc(owner, 'select public.cancel_request($1)', [canceled]);
  const indication = (
    await db.pool.query('select id from public.indications where request_id=$1', [none])
  ).rows[0].id;
  await rpc(admin, "select public.admin_moderate('HIDE_INDICATION',$1)", [indication]);
  const m = (await rpc(admin, 'select public.admin_metrics($1) m', [city])).rows[0].m;
  expect(m).toMatchObject({
    requests: 3,
    resolved: 1,
    other_place: 1,
    not_found: 1,
    with_indications: 3,
    contributors: 1,
    returning_contributors: 1,
  });
  expect(m.median_resolution_seconds).not.toBeNull();
  expect((await rpc(admin, 'select public.admin_metrics(3530300) m')).rows[0].m.requests).toBe(0);
  expect(
    (await rpc(admin, "select public.admin_metrics(null,'2100-01-01',null) m")).rows[0].m.requests,
  ).toBe(0);
  await expect(rpc(person, 'select public.admin_metrics()')).rejects.toThrow('NOT_ALLOWED');
});
test('tempo de resolução de outro local e ausência de resultado não contamina percentis', async () => {
  await indicate();
  await resolve('OTHER_PLACE');
  const m = (await rpc(admin, 'select public.admin_metrics() m')).rows[0].m;
  expect(m.resolved).toBe(0);
  expect(m.other_place).toBe(1);
  expect(m.avg_resolution_seconds).toBeNull();
  expect(m.p90_resolution_seconds).toBeNull();
});
test('busca portuguesa usa acentos, múltiplas palavras e respeita RLS', async () => {
  await rpc(owner, 'select public.edit_request($1,$2,$3)', [
    request,
    'Peça de reposição para máquina de café',
    city,
  ]);
  expect(
    (
      await rpc(person, "select id from public.search_requests($1,'cafe reposicao','OPEN',0)", [
        city,
      ])
    ).rows[0].id,
  ).toBe(request);
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [request]);
  expect(
    (await rpc(person, "select id from public.search_requests($1,'cafe','OPEN',0)", [city]))
      .rowCount,
  ).toBe(0);
});
test('histórico distingue encontro, clique e utilidade; utilidade é deduplicada', async () => {
  await indicate();
  await resolve();
  await rpc(follower, "select public.record_search_event('MATCHED',$1)", [city]);
  await rpc(follower, "select public.record_search_event('CLICKED',$1,$2)", [city, request]);
  await rpc(follower, "select public.record_search_event('USEFUL',$1,$2)", [city, request]);
  await rpc(follower, "select public.record_search_event('USEFUL',$1,$2)", [city, request]);
  expect((await rpc(admin, 'select public.admin_metrics($1) m', [city])).rows[0].m.search).toEqual({
    MATCHED: 1,
    CLICKED: 1,
    USEFUL: 1,
  });
  await expect(
    rpc(person, "select public.record_search_event('USEFUL',3530300,$1)", [request]),
  ).rejects.toThrow('NOT_ALLOWED');
  await expect(rpc(person, 'select * from private.search_events')).rejects.toThrow(
    'permission denied',
  );
});
test('moderação registra motivo, responsável e data', async () => {
  await rpc(
    person,
    "select public.report_content('REQUEST',$1,'Conteúdo inadequado para a comunidade')",
    [request],
  );
  const report = (
    await db.pool.query('select id from public.reports where reporter_id=$1', [person])
  ).rows[0].id;
  await rpc(
    admin,
    "select public.admin_moderate('REVIEW_REPORT',$1,'Revisado e mantido por estar de acordo com as regras')",
    [report],
  );
  const row = (await db.pool.query('select * from public.reports where id=$1', [report])).rows[0];
  expect(row.reviewed_by).toBe(admin);
  expect(row.reviewed_at).not.toBeNull();
  expect(row.decision_note).toContain('mantido');
  expect(
    (await db.pool.query("select * from public.audit_logs where event_type='MODERATION_DECISION'"))
      .rowCount,
  ).toBe(1);
  await expect(
    rpc(admin, "select public.admin_moderate_legacy('REVIEW_REPORT',$1)", [report]),
  ).rejects.toThrow('permission denied');
});
test('visualização de locais não consome o limite de submissão, mas compartilha o teto diário', async () => {
  for (let i = 0; i < 30; i++) await rpc(owner, "select public.consume_api_limit('places_view')");
  await expect(rpc(owner, "select public.consume_api_limit('places_view')")).rejects.toThrow(
    'RATE_LIMITED',
  );
  await expect(
    rpc(owner, "select public.consume_api_limit('places_details')"),
  ).resolves.toBeDefined();
});
test('exportação contém somente dados do titular e também seus textos moderados', async () => {
  await indicate();
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [request]);
  const data = (await rpc(owner, 'select public.export_account() data')).rows[0].data;
  expect(data.profile.id).toBe(owner);
  expect(data.requests).toHaveLength(1);
  expect(data.indications).toEqual([]);
  expect(data).not.toHaveProperty('accounts');
  expect(JSON.stringify(data)).not.toContain('Texto pessoal do indicante');
  await expect(db.as('anon', null, 'select public.export_account()')).rejects.toThrow(
    'permission denied',
  );
});
test('encerramento bloqueia, anonimiza e preserva ledger e referências', async () => {
  await indicate();
  await resolve();
  await rpc(person, 'select public.set_request_interest($1,true,true)', [request]);
  await rpc(person, 'select public.save_preferences(true)');
  const id = (
    await rpc(
      person,
      "select public.request_support('CLOSE_ACCOUNT','Quero encerrar minha conta e apagar meus textos') id",
    )
  ).rows[0].id;
  await expect(
    rpc(
      admin,
      "select public.admin_review_support($1,'COMPLETED','Atendimento concluído conforme solicitado')",
      [id],
    ),
  ).rejects.toThrow('CLOSURE_REQUIRED');
  expect((await rpc(admin, 'select public.prepare_account_closure($1) id', [id])).rows[0].id).toBe(
    person,
  );
  await expect(rpc(person, 'select public.member_summary()')).rejects.toThrow('ACCOUNT_BLOCKED');
  await rpc(
    admin,
    "select public.complete_account_closure($1,'Identidade encerrada e dados pessoais anonimizados')",
    [id],
  );
  const profile = (await db.pool.query('select * from public.profiles where id=$1', [person]))
    .rows[0];
  expect(profile.username).toMatch(/^deleted_/);
  expect(profile.display_name).toBe('Conta encerrada');
  expect(
    (await db.pool.query('select comment from public.indications')).rows[0].comment,
  ).toBeNull();
  expect((await db.pool.query('select points from public.reward_events')).rows).toEqual([
    { points: 10 },
  ]);
  expect(
    (await db.pool.query('select * from public.request_interests where user_id=$1', [person]))
      .rowCount,
  ).toBe(0);
  await expect(rpc(admin, 'select public.prepare_account_closure($1)', [id])).rejects.toThrow(
    'NOT_ALLOWED',
  );
});
test('encerramento cancela pedidos pendentes e anonimiza textos já resolvidos', async () => {
  await indicate();
  await resolve();
  const pending = await create();
  const id = (
    await rpc(
      owner,
      "select public.request_support('CLOSE_ACCOUNT','Encerrar meu perfil e meus pedidos pessoais') id",
    )
  ).rows[0].id;
  await rpc(admin, 'select public.prepare_account_closure($1)', [id]);
  await rpc(
    admin,
    "select public.complete_account_closure($1,'Conta encerrada após revisão da solicitação')",
    [id],
  );
  expect(
    (await db.pool.query('select description,status from public.requests where id=$1', [pending]))
      .rows[0],
  ).toEqual({ description: 'Pedido de conta encerrada', status: 'CANCELED' });
  expect(
    (await db.pool.query('select status from public.requests where id=$1', [request])).rows[0]
      .status,
  ).toBe('RESOLVED');
});
test('lembretes exigem opt-in, deduplicam e respeitam leases e desistência', async () => {
  await indicate();
  await db.pool.query("update public.requests set updated_at=now()-interval '2 days' where id=$1", [
    request,
  ]);
  expect((await db.as('service_role', null, 'select public.prepare_reminders() n')).rows[0].n).toBe(
    0,
  );
  await rpc(owner, 'select public.save_preferences(true)');
  expect((await db.as('service_role', null, 'select public.prepare_reminders() n')).rows[0].n).toBe(
    1,
  );
  expect((await db.as('service_role', null, 'select public.prepare_reminders() n')).rows[0].n).toBe(
    0,
  );
  const worker = randomUUID(),
    other = randomUUID();
  const jobs = (
    await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [worker])
  ).rows;
  expect(jobs).toHaveLength(1);
  expect(
    (await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [other]))
      .rowCount,
  ).toBe(0);
  await db.as('service_role', null, 'select public.finish_email_job($1,$2,true)', [
    jobs[0].id,
    other,
  ]);
  expect((await db.pool.query('select status from private.email_jobs')).rows[0].status).toBe(
    'PROCESSING',
  );
  await rpc(owner, 'select public.save_preferences(false)');
  expect(
    (
      await db.as('service_role', null, 'select public.email_job_eligible($1,$2) ok', [
        jobs[0].id,
        worker,
      ])
    ).rows[0].ok,
  ).toBe(false);
  expect((await db.pool.query('select status from private.email_jobs')).rows[0].status).toBe(
    'CANCELED',
  );
  await expect(rpc(owner, 'select public.prepare_reminders()')).rejects.toThrow(
    'permission denied',
  );
});
test('worker retoma lease vencido sem reentregar job enviado e cancela retries antigos', async () => {
  await indicate();
  await db.pool.query("update public.requests set updated_at=now()-interval '2 days' where id=$1", [
    request,
  ]);
  await rpc(owner, 'select public.save_preferences(true)');
  await db.as('service_role', null, 'select public.prepare_reminders()');
  const worker = randomUUID();
  const job = (
    await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [worker])
  ).rows[0];
  await db.pool.query("update private.email_jobs set lease_until=now()-interval '1 minute'");
  const other = randomUUID();
  expect(
    (await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [other]))
      .rowCount,
  ).toBe(1);
  await db.as('service_role', null, 'select public.finish_email_job($1,$2,true)', [job.id, other]);
  expect(
    (await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [worker]))
      .rowCount,
  ).toBe(0);
  await db.pool.query(
    "update private.email_jobs set status='PENDING',first_attempt_at=now()-interval '24 hours'",
  );
  expect(
    (await db.as('service_role', null, 'select * from public.claim_email_jobs($1)', [worker]))
      .rowCount,
  ).toBe(0);
});
test('health é serviço exclusivo e estatísticas contam ações sem mudar recompensas', async () => {
  await indicate();
  await resolve();
  expect((await rpc(person, "select public.profile_stats('test_1') s")).rows[0].s).toEqual({
    points: 10,
    confirmations: 1,
    requests: 0,
    indications: 1,
  });
  await expect(rpc(person, 'select public.health_check()')).rejects.toThrow('permission denied');
  expect((await db.as('service_role', null, 'select public.health_check() ok')).rows[0].ok).toBe(
    true,
  );
});

test('busca indexada rejeita conta bloqueada e ausência de onboarding', async () => {
  const pending = randomUUID();
  await db.pool.query('insert into auth.users(id) values($1)', [pending]);
  await expect(rpc(pending, 'select * from public.search_requests($1)', [city])).rejects.toThrow(
    'ONBOARDING_REQUIRED',
  );
  await rpc(admin, "select public.admin_moderate('BLOCK_USER',$1)", [person]);
  await expect(rpc(person, 'select * from public.search_requests($1)', [city])).rejects.toThrow(
    'ACCOUNT_BLOCKED',
  );
});
test('encerramento em processamento só pode ser retomado, sem recusa que abandonaria a identidade', async () => {
  const id = (
    await rpc(
      owner,
      "select public.request_support('CLOSE_ACCOUNT','Encerrar minha conta e meus dados pessoais') id",
    )
  ).rows[0].id;
  await rpc(admin, 'select public.prepare_account_closure($1)', [id]);
  await expect(
    rpc(
      admin,
      "select public.admin_review_support($1,'DECLINED','Recusada após início do processamento')",
      [id],
    ),
  ).rejects.toThrow('CLOSURE_REQUIRED');
  expect(
    (await db.pool.query('select status from public.support_requests where id=$1', [id])).rows[0]
      .status,
  ).toBe('PROCESSING');
});
test('catálogo aplicado recebe atualização sem recriar banco nem remover referências', async () => {
  const previous = (await db.pool.query('select * from public.cities where id=$1', [city])).rows[0];
  try {
    const migration = cityMigration(
      [
        {
          id: city,
          nome: "Rio Preto d'Água",
          microrregiao: { mesorregiao: { UF: { sigla: 'SP', nome: 'São Paulo' } } },
        },
      ],
      new Date(),
      1,
    );
    await db.pool.query(migration.sql);
    expect(
      (await db.pool.query('select name from public.cities where id=$1', [city])).rows[0].name,
    ).toBe("Rio Preto d'Água");
    expect(
      (await db.pool.query('select city_id from public.requests where id=$1', [request])).rows[0]
        .city_id,
    ).toBe(city);
  } finally {
    await db.pool.query(
      'update public.cities set name=$2,normalized_name=$3,state_name=$4,state_code=$5,slug=$6 where id=$1',
      [
        city,
        previous.name,
        previous.normalized_name,
        previous.state_name,
        previous.state_code,
        previous.slug,
      ],
    );
  }
});
