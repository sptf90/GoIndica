import { beforeAll, afterAll, beforeEach, describe, test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { testDatabase, identity } from './database';
let db: Awaited<ReturnType<typeof testDatabase>>;
let owner: string, joao: string, maria: string, carlos: string, admin: string, request: string;
const rio = 3549805,
  mirassol = 3530300;
async function create(actor = owner, city = rio) {
  const r = await db.as('authenticated', actor, 'select public.create_request($1,$2) id', [
    'Farinha Caputo para pizza',
    city,
  ]);
  return r.rows[0].id as string;
}
async function indicate(actor = joao, place = 'place_A', req = request, city = rio) {
  const r = await db.as(
    'service_role',
    null,
    'select public.submit_verified_indication($1,$2,$3,$4,$5) id',
    [actor, req, place, city, 'Conheço este estabelecimento'],
  );
  return r.rows[0].id as string;
}
async function reveal(req = request, actor = owner) {
  return db.as('authenticated', actor, 'select public.reveal_responses($1)', [req]);
}
async function resolve(
  place: string | null,
  type = 'INDICATED_PLACE',
  actor = owner,
  req = request,
) {
  return db.as('authenticated', actor, 'select public.resolve_request($1,$2,$3) id', [
    req,
    type,
    place,
  ]);
}
async function placeId(google = 'place_A') {
  return (await db.pool.query('select id from public.places where google_place_id=$1', [google]))
    .rows[0].id as string;
}
async function rewards() {
  return (await db.pool.query('select * from public.reward_events order by user_id')).rows;
}
beforeAll(async () => {
  db = await testDatabase();
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.pool.query(
    'truncate auth.users,private.accounts,public.profiles,public.requests,public.places,public.indications,public.request_resolutions,public.reward_events,public.reports,public.audit_logs,private.rate_limits,private.analytics,private.public_rate_limits cascade',
  );
  [owner, joao, maria, carlos, admin] = Array.from({ length: 5 }, () => randomUUID());
  for (const [index, id] of [owner, joao, maria, carlos, admin].entries()) {
    await db.pool.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
      id,
      { avatar_url: 'https://lh3.googleusercontent.com/photo' },
    ]);
    await db.as('authenticated', id, 'select public.save_profile($1,$2,$3,true)', [
      'pessoa_' + index,
      'Pessoa ' + index,
      index === 2 ? mirassol : rio,
    ]);
  }
  await db.pool.query('update private.accounts set is_admin=true where id=$1', [admin]);
  request = await create();
});
describe('Identidade, onboarding e autorização', () => {
  test('cria conta interna e log de cadastro a partir da identidade autenticada', async () => {
    expect(
      (
        await db.pool.query(
          "select count(*)::int n from public.audit_logs where event_type='SIGNUP'",
        )
      ).rows[0].n,
    ).toBe(5);
    expect(
      (await db.as('authenticated', owner, 'select public.account_state() state')).rows[0].state,
    ).toEqual({ admin: false, onboarded: true });
  });
  test('onboarding exige cidade estruturada e username único', async () => {
    const id = randomUUID();
    await db.pool.query('insert into auth.users(id) values($1)', [id]);
    await expect(create(id)).rejects.toThrow('ONBOARDING_REQUIRED');
    await expect(
      db.as('authenticated', id, "select public.save_profile('pessoa_0','Outra',3549805,true)"),
    ).rejects.toThrow('duplicate key');
    await expect(
      db.as('authenticated', id, "select public.save_profile('novo','Outra',9999999,true)"),
    ).rejects.toThrow('foreign key');
  });
  test('visitante não indica nem consulta pedidos e não recebe detalhes', async () => {
    await expect(
      db.as('anon', null, 'select public.submit_verified_indication($1,$2,$3,$4)', [
        joao,
        request,
        'place_A',
        rio,
      ]),
    ).rejects.toThrow('permission denied');
    await expect(db.as('anon', null, 'select * from public.requests')).rejects.toThrow(
      'permission denied',
    );
    await expect(
      db.as('authenticated', null, 'select public.create_request($1,$2)', ['Pedido', rio]),
    ).rejects.toThrow('AUTH_REQUIRED');
  });
  test('identidade enviada no formulário não substitui auth.uid', async () => {
    await expect(reveal(request, joao)).rejects.toThrow('NOT_ALLOWED');
    await expect(
      db.as('authenticated', joao, 'select public.cancel_request($1)', [request]),
    ).rejects.toThrow('NOT_ALLOWED');
    await expect(
      db.as('authenticated', joao, 'select public.admin_moderate($1,$2)', ['BLOCK_USER', owner]),
    ).rejects.toThrow('NOT_ALLOWED');
    await expect(
      db.as(
        'authenticated',
        joao,
        "select public.save_profile('usuario_novo','Nome',3549805,true)",
      ),
    ).resolves.toBeDefined();
    expect(
      (await db.pool.query('select username from public.profiles where id=$1', [owner])).rows[0]
        .username,
    ).toBe('pessoa_0');
  });
  test('bloqueio impede ações e leituras mesmo com token válido', async () => {
    await db.as('authenticated', admin, "select public.admin_moderate('BLOCK_USER',$1)", [joao]);
    await expect(create(joao)).rejects.toThrow('ACCOUNT_BLOCKED');
    await expect(indicate(joao)).rejects.toThrow('NOT_ALLOWED');
    expect((await db.as('authenticated', joao, 'select * from public.requests')).rowCount).toBe(0);
  });
  test('RLS/grants proíbem escritas diretas e a RPC exclusiva do servidor', async () => {
    for (const table of [
      'requests',
      'indications',
      'request_resolutions',
      'reward_events',
      'profiles',
      'cities',
    ])
      await expect(db.as('authenticated', joao, `delete from public.${table}`)).rejects.toThrow(
        'permission denied',
      );
    await expect(
      db.as('authenticated', joao, 'select public.submit_verified_indication($1,$2,$3,$4)', [
        joao,
        request,
        'place_A',
        rio,
      ]),
    ).rejects.toThrow('permission denied');
    await expect(db.as('authenticated', joao, 'select * from private.accounts')).rejects.toThrow(
      'permission denied',
    );
    expect((await db.as('authenticated', joao, 'select * from public.audit_logs')).rowCount).toBe(
      0,
    );
  });
});
describe('Indicações e privacidade', () => {
  test('impede autoindicação no banco', async () => {
    await expect(indicate(owner)).rejects.toThrow('SELF_INDICATION');
  });
  test('uma indicação por pessoa, inclusive tentativas concorrentes', async () => {
    const results = await Promise.allSettled([indicate(), indicate(joao, 'place_B')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await db.pool.query('select count(*)::int n from public.indications')).rows[0].n).toBe(
      1,
    );
  });
  test('rejeita cidade diferente da solicitação', async () => {
    await expect(indicate(joao, 'place_A', request, mirassol)).rejects.toThrow('INVALID_CITY');
    expect(await rewards()).toHaveLength(0);
  });
  test('morador de outra cidade pode indicar local da cidade do pedido', async () => {
    await expect(indicate(maria)).resolves.toBeDefined();
  });
  test('dois indicantes compartilham um place_id sem compartilhar a resposta', async () => {
    await Promise.all([indicate(joao), indicate(maria)]);
    expect((await db.pool.query('select count(*)::int n from public.places')).rows[0].n).toBe(1);
    expect(
      (await db.pool.query('select indication_count from public.requests where id=$1', [request]))
        .rows[0].indication_count,
    ).toBe(2);
    expect((await db.as('authenticated', owner, 'select * from public.indications')).rowCount).toBe(
      0,
    );
    expect((await db.as('authenticated', owner, 'select * from public.places')).rowCount).toBe(0);
    expect(
      (await db.as('authenticated', carlos, 'select * from public.indications')).rowCount,
    ).toBe(0);
    expect((await db.as('authenticated', joao, 'select * from public.indications')).rowCount).toBe(
      1,
    );
  });
  test('revelação é atômica, idempotente e mostra somente ao autor', async () => {
    await indicate();
    await reveal();
    await reveal();
    await expect(indicate(maria)).rejects.toThrow('RESPONSES_LOCKED');
    expect((await db.as('authenticated', owner, 'select * from public.indications')).rowCount).toBe(
      1,
    );
    expect((await db.as('authenticated', owner, 'select * from public.places')).rowCount).toBe(1);
    expect((await db.as('authenticated', carlos, 'select * from public.places')).rowCount).toBe(0);
    expect(
      (await db.as('authenticated', owner, 'select * from public.indication_groups($1)', [request]))
        .rows[0].indications,
    ).toBe('1');
    await expect(
      db.as('authenticated', carlos, 'select * from public.indication_groups($1)', [request]),
    ).rejects.toThrow('NOT_ALLOWED');
  });
  test('edição bloqueada após primeira indicação, inclusive indicação removida', async () => {
    await db.as('authenticated', owner, 'select public.edit_request($1,$2,$3)', [
      request,
      'Uma massa italiana',
      rio,
    ]);
    const id = await indicate();
    await expect(
      db.as('authenticated', owner, 'select public.edit_request($1,$2,$3)', [
        request,
        'Pedido alterado',
        rio,
      ]),
    ).rejects.toThrow('EDIT_LOCKED');
    await db.as('authenticated', admin, "select public.admin_moderate('HIDE_INDICATION',$1)", [id]);
    await expect(
      db.as('authenticated', owner, 'select public.edit_request($1,$2,$3)', [
        request,
        'Pedido alterado',
        rio,
      ]),
    ).rejects.toThrow('EDIT_LOCKED');
  });
  test('cancelamento bloqueia indicações e não pode reabrir', async () => {
    await db.as('authenticated', owner, 'select public.cancel_request($1)', [request]);
    await expect(indicate()).rejects.toThrow('RESPONSES_LOCKED');
    await expect(
      db.pool.query("update public.requests set status='OPEN',canceled_at=null where id=$1", [
        request,
      ]),
    ).rejects.toThrow('INVALID_TRANSITION');
  });
  test('não revela sem indicações e não aceita resolução antes da revelação', async () => {
    await expect(reveal()).rejects.toThrow('NO_INDICATIONS');
    await indicate();
    await expect(resolve(await placeId())).rejects.toThrow('REVEAL_REQUIRED');
  });
});
describe('Resolução, recompensas e ranking', () => {
  test('local indicado por uma pessoa rende exatamente +10', async () => {
    await indicate();
    expect(await rewards()).toHaveLength(0);
    await reveal();
    await resolve(await placeId());
    expect(await rewards()).toMatchObject([{ user_id: joao, points: 10, city_id: rio }]);
    await expect(indicate(maria)).rejects.toThrow('RESPONSES_LOCKED');
  });
  test('recompensa todos do mesmo local, exclui outro local e usa cidade do pedido', async () => {
    await indicate(joao);
    await indicate(maria);
    await indicate(carlos, 'place_B');
    await reveal();
    await resolve(await placeId());
    const ledger = await rewards();
    expect(ledger).toHaveLength(2);
    expect(ledger.map((r) => r.user_id).sort()).toEqual([joao, maria].sort());
    expect(ledger.every((r) => r.points === 10 && r.city_id === rio)).toBe(true);
    const ranking = await db.as('anon', null, 'select * from public.city_ranking($1)', [rio]);
    expect(ranking.rowCount).toBe(2);
    expect(
      (await db.as('anon', null, 'select * from public.city_ranking($1)', [mirassol])).rowCount,
    ).toBe(0);
    expect(
      (await db.as('authenticated', carlos, 'select * from public.reward_events')).rowCount,
    ).toBe(0);
    expect(
      (await db.as('authenticated', joao, 'select * from public.reward_events')).rowCount,
    ).toBe(1);
  });
  test.each(['NOT_FOUND', 'OTHER_PLACE'])('%s encerra sem recompensas', async (type) => {
    await indicate();
    await reveal();
    await resolve(null, type);
    expect(await rewards()).toHaveLength(0);
    expect((await db.pool.query('select type from public.request_resolutions')).rows[0].type).toBe(
      type,
    );
  });
  test('duplo clique, retry e confirmação em dois dispositivos são idempotentes', async () => {
    await indicate(joao);
    await indicate(maria);
    await reveal();
    const place = await placeId();
    const results = await Promise.all([resolve(place), resolve(place), resolve(place)]);
    expect(new Set(results.map((r) => r.rows[0].id)).size).toBe(1);
    await resolve(place);
    expect(await rewards()).toHaveLength(2);
    expect(
      (await db.pool.query('select count(*)::int n from public.request_resolutions')).rows[0].n,
    ).toBe(1);
  });
  test('confirmações simultâneas de locais diferentes não distribuem recompensas duas vezes', async () => {
    await indicate(joao);
    await indicate(maria, 'place_B');
    await reveal();
    const result = await Promise.allSettled([
      resolve(await placeId()),
      resolve(await placeId('place_B')),
    ]);
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await rewards()).toHaveLength(1);
    expect(
      (await db.pool.query('select count(*)::int n from public.request_resolutions')).rows[0].n,
    ).toBe(1);
  });
  test('ID de lugar de outra solicitação é rejeitado', async () => {
    await indicate();
    const another = await create();
    await indicate(maria, 'place_B', another);
    await reveal();
    await expect(resolve(await placeId('place_B'))).rejects.toThrow('INVALID_PLACE');
    await expect(resolve(await placeId(), 'INDICATED_PLACE', carlos)).rejects.toThrow(
      'NOT_ALLOWED',
    );
  });
  test('histórico público autenticado mostra vencedor sem abrir todas as respostas', async () => {
    await indicate();
    await indicate(maria, 'place_B');
    await reveal();
    await resolve(await placeId());
    expect(
      (await db.as('authenticated', carlos, 'select * from public.request_resolutions')).rowCount,
    ).toBe(1);
    expect((await db.as('authenticated', carlos, 'select * from public.places')).rowCount).toBe(1);
    expect(
      (await db.as('authenticated', carlos, 'select * from public.indications')).rowCount,
    ).toBe(0);
  });
  test('ledger e resolução são imutáveis, pontos diferentes e duplicatas são rejeitados', async () => {
    await indicate();
    await reveal();
    await resolve(await placeId());
    await expect(db.pool.query('update public.reward_events set points=20')).rejects.toThrow(
      'IMMUTABLE_LEDGER',
    );
    await expect(db.pool.query('delete from public.request_resolutions')).rejects.toThrow(
      'IMMUTABLE_LEDGER',
    );
    const reward = (await rewards())[0];
    await expect(
      db.pool.query(
        'insert into public.reward_events(user_id,request_id,indication_id,city_id) values($1,$2,$3,$4)',
        [reward.user_id, request, reward.indication_id, rio],
      ),
    ).rejects.toThrow('duplicate key');
    await expect(
      db.pool.query(
        'insert into public.reward_events(user_id,request_id,indication_id,city_id) values($1,$2,$3,$4)',
        [maria, request, reward.indication_id, rio],
      ),
    ).rejects.toThrow('INVALID_REWARD');
  });
  test('indicações moderadas e contas bloqueadas não recebem novas recompensas', async () => {
    await indicate();
    const id = await indicate(maria);
    await indicate(carlos);
    await db.as('authenticated', admin, "select public.admin_moderate('HIDE_INDICATION',$1)", [id]);
    await db.as('authenticated', admin, "select public.admin_moderate('BLOCK_USER',$1)", [carlos]);
    await reveal();
    await resolve(await placeId());
    expect(await rewards()).toMatchObject([{ user_id: joao }]);
  });
  test('desempate estável e ordenação por primeira confirmação', async () => {
    await indicate(joao);
    await indicate(maria);
    await reveal();
    await resolve(await placeId());
    const first = await db.as('anon', null, 'select * from public.city_ranking($1)', [rio]);
    const second = await db.as('anon', null, 'select * from public.city_ranking($1)', [rio]);
    expect(first.rows).toEqual(second.rows);
    const min = [joao, maria].sort()[0];
    expect(first.rows[0].username).toBe(min === joao ? 'pessoa_1' : 'pessoa_2');
  });
});
describe('Corridas com locks de verdade', () => {
  test('indicação vence primeiro: revelação aguarda e inclui a contribuição', async () => {
    await indicate();
    const client = await db.pool.connect();
    await identity(client, 'service_role', null);
    await client.query('select public.submit_verified_indication($1,$2,$3,$4)', [
      maria,
      request,
      'place_A',
      rio,
    ]);
    let done = false;
    const pending = reveal().then(() => {
      done = true;
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(done).toBe(false);
    await client.query('commit');
    client.release();
    await pending;
    expect(
      (
        await db.pool.query('select indication_count,status from public.requests where id=$1', [
          request,
        ])
      ).rows[0],
    ).toMatchObject({ indication_count: 2, status: 'REVEALED' });
  });
  test('revelação vence primeiro: indicação aguarda e é rejeitada após commit', async () => {
    await indicate();
    const client = await db.pool.connect();
    await identity(client, 'authenticated', owner);
    await client.query('select public.reveal_responses($1)', [request]);
    let done = false;
    const pending = indicate(maria).then(
      () => ({ ok: true }),
      (e) => {
        done = true;
        return { ok: false, message: String(e) };
      },
    );
    await new Promise((r) => setTimeout(r, 80));
    expect(done).toBe(false);
    await client.query('commit');
    client.release();
    expect(await pending).toMatchObject({
      ok: false,
      message: expect.stringContaining('RESPONSES_LOCKED'),
    });
    expect((await db.pool.query('select count(*)::int n from public.indications')).rows[0].n).toBe(
      1,
    );
  });
});
describe('Moderação, limites e auditoria', () => {
  test('denúncias autorizadas e alvo manipulado rejeitado', async () => {
    await db.as(
      'authenticated',
      joao,
      "select public.report_content('REQUEST',$1,'Conteúdo impróprio neste pedido')",
      [request],
    );
    await expect(
      db.as(
        'authenticated',
        joao,
        "select public.report_content('REQUEST',$1,'Conteúdo impróprio neste pedido')",
        [randomUUID()],
      ),
    ).rejects.toThrow('NOT_ALLOWED');
    const indication = await indicate();
    await expect(
      db.as(
        'authenticated',
        carlos,
        "select public.report_content('INDICATION',$1,'Conteúdo impróprio nesta indicação')",
        [indication],
      ),
    ).rejects.toThrow('NOT_ALLOWED');
    expect((await db.as('authenticated', maria, 'select * from public.reports')).rowCount).toBe(0);
    expect((await db.as('authenticated', admin, 'select * from public.reports')).rowCount).toBe(1);
  });
  test('remoção preserva ledger e esconde conteúdo histórico', async () => {
    await indicate();
    await reveal();
    await resolve(await placeId());
    await db.as('authenticated', admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [
      request,
    ]);
    expect((await db.as('authenticated', carlos, 'select * from public.requests')).rowCount).toBe(
      0,
    );
    expect(
      (await db.as('authenticated', carlos, 'select * from public.request_resolutions')).rowCount,
    ).toBe(0);
    expect((await db.as('authenticated', carlos, 'select * from public.places')).rowCount).toBe(0);
    expect(await rewards()).toHaveLength(1);
  });
  test('limites compartilhados persistem no banco', async () => {
    for (let i = 0; i < 30; i++)
      await db.as('authenticated', joao, "select public.consume_api_limit('places_search')");
    await expect(
      db.as('authenticated', joao, "select public.consume_api_limit('places_search')"),
    ).rejects.toThrow('RATE_LIMITED');
    for (let i = 0; i < 9; i++) await create();
    await expect(create()).rejects.toThrow('RATE_LIMITED');
  });
  test('logs sem emails ou secrets e sinais de auditoria sem punição', async () => {
    await indicate();
    await reveal();
    await resolve(await placeId());
    const logs = (await db.as('authenticated', admin, 'select * from public.audit_logs')).rows;
    expect(logs.some((l) => l.event_type === 'RESOLUTION_AUDIT_SIGNALS')).toBe(true);
    expect(JSON.stringify(logs)).not.toMatch(/email|token|password|secret/i);
  });
});
describe('Defesas adicionais e auditoria', () => {
  test('triggers impedem uma escrita privilegiada de burlar autoindicação, cidade e status', async () => {
    await indicate();
    const place = await placeId();
    await expect(
      db.pool.query(
        'insert into public.indications(request_id,user_id,place_id) values($1,$2,$3)',
        [request, owner, place],
      ),
    ).rejects.toThrow('SELF_INDICATION');
    await reveal();
    await expect(
      db.pool.query(
        'insert into public.indications(request_id,user_id,place_id) values($1,$2,$3)',
        [request, maria, place],
      ),
    ).rejects.toThrow('RESPONSES_LOCKED');
    await expect(
      db.pool.query('update public.requests set description=$1 where id=$2', [
        'Conteúdo alterado',
        request,
      ]),
    ).rejects.toThrow('EDIT_LOCKED');
  });
  test('transação de resolução falha inteira quando o ledger falha', async () => {
    await indicate();
    await reveal();
    await db.pool.query(
      `create function private.test_reject_reward() returns trigger language plpgsql as $$begin raise exception 'SIMULATED_FAILURE'; end$$;create trigger test_reject_reward before insert on public.reward_events for each row execute function private.test_reject_reward();`,
    );
    try {
      await expect(resolve(await placeId())).rejects.toThrow('SIMULATED_FAILURE');
      expect(await rewards()).toHaveLength(0);
      expect((await db.pool.query('select * from public.request_resolutions')).rowCount).toBe(0);
      expect(
        (await db.pool.query('select status from public.requests where id=$1', [request])).rows[0]
          .status,
      ).toBe('REVEALED');
    } finally {
      await db.pool.query(
        'drop trigger test_reject_reward on public.reward_events;drop function private.test_reject_reward()',
      );
    }
  });
  test('grants explícitos também impedem funções internas e analytics pelo cliente', async () => {
    await expect(db.as('authenticated', joao, 'select private.actor()')).rejects.toThrow(
      'permission denied',
    );
    await expect(
      db.as('authenticated', joao, "select public.record_analytics('CTA_CLICK',$1)", [
        'a'.repeat(64),
      ]),
    ).rejects.toThrow('permission denied');
    const fp = 'a'.repeat(64);
    for (let i = 0; i < 60; i++)
      await db.as('service_role', null, "select public.record_analytics('CTA_CLICK',$1)", [fp]);
    await expect(
      db.as('service_role', null, "select public.record_analytics('CTA_CLICK',$1)", [fp]),
    ).rejects.toThrow('RATE_LIMITED');
  });
  test('admin não pode bloquear a si mesmo e pode desbloquear com log', async () => {
    await expect(
      db.as('authenticated', admin, "select public.admin_moderate('BLOCK_USER',$1)", [admin]),
    ).rejects.toThrow('NOT_ALLOWED');
    await db.as('authenticated', admin, "select public.admin_moderate('BLOCK_USER',$1)", [joao]);
    await db.as('authenticated', admin, "select public.admin_moderate('UNBLOCK_USER',$1)", [joao]);
    await expect(indicate()).resolves.toBeDefined();
    expect(
      (
        await db.pool.query(
          "select count(*)::int n from public.audit_logs where event_type in ('BLOCK_USER','UNBLOCK_USER')",
        )
      ).rows[0].n,
    ).toBe(2);
  });
});
test('todas as tabelas têm RLS e nenhum definer concede EXECUTE a PUBLIC', async () => {
  const tables = await db.pool.query(
    "select relname,relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','private') and c.relkind='r'",
  );
  expect(tables.rows.every((r) => r.relrowsecurity)).toBe(true);
  const functions = await db.pool.query(
    "select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl where n.nspname in ('public','private') and p.prosecdef and acl.grantee=0 and acl.privilege_type='EXECUTE'",
  );
  expect(functions.rows).toEqual([]);
});
