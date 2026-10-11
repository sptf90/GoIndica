import { beforeAll, afterAll, beforeEach, test, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { testDatabase } from './database';
let db: Awaited<ReturnType<typeof testDatabase>>,
  owner: string,
  helper: string,
  visitor: string,
  admin: string,
  request: string,
  jpeg: string;
const city = 3549805;
const rpc = (actor: string, sql: string, args: unknown[] = []) =>
  db.as('authenticated', actor, sql, args);
async function create(description = 'Peça para máquina de café', municipality = city) {
  return (await rpc(owner, 'select public.create_request($1,$2) id', [description, municipality]))
    .rows[0].id as string;
}
async function indicate(id = request) {
  await db.as('service_role', null, 'select public.submit_verified_indication($1,$2,$3,$4)', [
    helper,
    id,
    'discovery_place',
    city,
  ]);
}
async function resolve(type = 'INDICATED_PLACE') {
  await indicate();
  await rpc(owner, 'select public.reveal_responses($1)', [request]);
  const place =
    type === 'INDICATED_PLACE'
      ? (await db.pool.query('select id from public.places limit 1')).rows[0].id
      : null;
  await rpc(owner, 'select public.resolve_request($1,$2,$3)', [request, type, place]);
}
beforeAll(async () => {
  db = await testDatabase();
  jpeg = (
    await sharp({ create: { width: 60, height: 40, channels: 3, background: '#347d25' } })
      .jpeg()
      .toBuffer()
  ).toString('base64');
});
afterAll(async () => {
  await db?.stop();
});
beforeEach(async () => {
  await db.pool.query(
    'truncate auth.users,private.rate_limits,private.analytics,private.public_rate_limits cascade',
  );
  [owner, helper, visitor, admin] = Array.from({ length: 4 }, () => randomUUID());
  for (const [index, id] of [owner, helper, visitor, admin].entries()) {
    await db.pool.query('insert into auth.users(id) values($1)', [id]);
    await rpc(id, 'select public.save_profile($1,$2,$3,false)', [
      'discovery_' + index,
      'Pessoa ' + index,
      city,
    ]);
  }
  await db.pool.query('update private.accounts set is_admin=true where id=$1', [admin]);
  request = await create();
});

test('também procuro é idempotente, preserva salvos, acompanha e conta sem revelar participantes', async () => {
  await rpc(visitor, 'select public.set_request_interest($1,true,false)', [request]);
  await Promise.all(
    Array.from({ length: 5 }, () =>
      rpc(visitor, 'select public.set_request_wanted($1,true)', [request]),
    ),
  );
  await rpc(helper, 'select public.set_request_wanted($1,true)', [request]);
  expect(
    (await rpc(visitor, 'select saved,following,wanted from public.request_interests')).rows,
  ).toEqual([{ saved: true, following: true, wanted: true }]);
  expect(
    (await rpc(owner, 'select wanting_count from public.requests where id=$1', [request])).rows[0]
      .wanting_count,
  ).toBe(2);
  expect((await rpc(owner, 'select * from public.request_interests')).rowCount).toBe(0);
  await rpc(visitor, 'select public.set_request_wanted($1,false)', [request]);
  expect(
    (await rpc(visitor, 'select saved,following,wanted from public.request_interests')).rows[0],
  ).toEqual({ saved: true, following: true, wanted: false });
  expect(
    (await db.pool.query('select wanting_count from public.requests where id=$1', [request]))
      .rows[0].wanting_count,
  ).toBe(1);
  await expect(rpc(owner, 'select public.set_request_wanted($1,true)', [request])).rejects.toThrow(
    'NOT_ALLOWED',
  );
  await resolve();
  expect(
    (await rpc(visitor, "select kind from public.notifications where kind='RESULT_RECORDED'"))
      .rowCount,
  ).toBe(1);
  await expect(
    rpc(visitor, 'select public.set_request_wanted($1,true)', [request]),
  ).rejects.toThrow('REQUEST_CLOSED');
  await rpc(helper, 'select public.set_request_wanted($1,false)', [request]);
});

test('reconfirmações concorrentes têm data, são privadas, deduplicadas e não geram pontos', async () => {
  await expect(rpc(visitor, 'select public.reconfirm_discovery($1)', [request])).rejects.toThrow(
    'NOT_ALLOWED',
  );
  await resolve();
  await Promise.all(
    Array.from({ length: 4 }, () =>
      rpc(visitor, 'select public.reconfirm_discovery($1)', [request]),
    ),
  );
  const row = (await rpc(visitor, 'select * from public.request_reconfirmations')).rows[0];
  expect(row.confirmed_at).toBeInstanceOf(Date);
  expect((await rpc(owner, 'select * from public.request_reconfirmations')).rowCount).toBe(0);
  await rpc(helper, 'select public.reconfirm_discovery($1)', [request]);
  const counts = (
    await db.pool.query(
      'select reconfirmation_count,last_reconfirmed_at from public.requests where id=$1',
      [request],
    )
  ).rows[0];
  expect(counts.reconfirmation_count).toBe(2);
  expect(counts.last_reconfirmed_at).toBeInstanceOf(Date);
  expect((await db.pool.query('select points from public.reward_events')).rows).toEqual([
    { points: 10 },
  ]);
  await expect(rpc(owner, 'select public.reconfirm_discovery($1)', [request])).rejects.toThrow(
    'NOT_ALLOWED',
  );
  await expect(
    rpc(visitor, 'update public.request_reconfirmations set confirmed_at=now()'),
  ).rejects.toThrow('permission denied');
});
test('outro local e moderação não permitem reconfirmar descobertas sem local confirmado', async () => {
  await resolve('OTHER_PLACE');
  await expect(rpc(visitor, 'select public.reconfirm_discovery($1)', [request])).rejects.toThrow(
    'NOT_ALLOWED',
  );
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [request]);
  await expect(
    rpc(visitor, 'select public.set_request_wanted($1,false)', [request]),
  ).rejects.toThrow('NOT_ALLOWED');
});

test('alertas respeitam cidade, acentos e todas as palavras; deduplicam por destinatário e pedido', async () => {
  await rpc(visitor, "select public.add_topic_alert($1,'máquina café')", [city]);
  await rpc(visitor, "select public.add_topic_alert($1,'MAQUINA CAFE')", [city]);
  await rpc(visitor, "select public.add_topic_alert($1,'café')", [city]);
  await rpc(helper, "select public.add_topic_alert(3530300,'café')");
  expect((await rpc(visitor, 'select * from public.topic_alerts')).rowCount).toBe(2);
  expect((await rpc(owner, 'select * from public.topic_alerts')).rowCount).toBe(0);
  const matched = await create('Reposição para máquina de cafe');
  await create('Peça para máquina industrial');
  expect(
    (
      await rpc(
        visitor,
        "select request_id,kind from public.notifications where kind='TOPIC_MATCH'",
      )
    ).rows,
  ).toEqual([{ request_id: matched, kind: 'TOPIC_MATCH' }]);
  expect((await rpc(helper, 'select * from public.notifications')).rowCount).toBe(0);
  await rpc(owner, "select public.edit_request($1,'Peça para máquina de café', $2)", [
    matched,
    city,
  ]);
  expect((await rpc(visitor, 'select * from public.notifications')).rowCount).toBe(1);
  const alert = (await rpc(visitor, 'select id from public.topic_alerts limit 1')).rows[0].id;
  await rpc(owner, 'select public.remove_topic_alert($1)', [alert]);
  expect((await rpc(visitor, 'select * from public.topic_alerts')).rowCount).toBe(2);
  await rpc(visitor, 'select public.remove_topic_alert($1)', [alert]);
  await rpc(visitor, 'select public.remove_topic_alert(id) from public.topic_alerts');
  await create('Máquina de café para casa');
  expect((await rpc(visitor, 'select * from public.notifications')).rowCount).toBe(1);
});
test('alertas rejeitam texto sem termos, têm limite e não avisam autor ou conta bloqueada', async () => {
  await expect(rpc(visitor, "select public.add_topic_alert($1,'para de')", [city])).rejects.toThrow(
    'INVALID_INPUT',
  );
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      rpc(visitor, 'select public.add_topic_alert($1,$2)', [city, 'bicicleta ' + i]),
    ),
  );
  await expect(rpc(visitor, "select public.add_topic_alert($1,'costura')", [city])).rejects.toThrow(
    'TOPIC_LIMIT',
  );
  await rpc(owner, "select public.add_topic_alert($1,'bicicleta')", [city]);
  await rpc(admin, "select public.admin_moderate('BLOCK_USER',$1)", [visitor]);
  await create('Bicicleta 0');
  expect((await rpc(owner, 'select * from public.notifications')).rowCount).toBe(0);
  expect(
    (await db.pool.query('select * from public.notifications where user_id=$1', [visitor]))
      .rowCount,
  ).toBe(0);
});

test('sem indicação ordena mais antigos primeiro, filtra cidade e texto e exclui respondidos e ocultos', async () => {
  const older = request,
    newer = await create('Peça para máquina de cafe');
  await create('Peça para café em outra cidade', 3530300);
  const ids = (
    await rpc(visitor, "select id from public.search_unanswered_requests($1,'cafe')", [city])
  ).rows.map((r) => r.id);
  expect(ids).toEqual([older, newer]);
  await indicate(older);
  expect(
    (await rpc(visitor, 'select id from public.search_unanswered_requests($1)', [city])).rows,
  ).toEqual([{ id: newer }]);
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [newer]);
  expect(
    (await rpc(visitor, 'select * from public.search_unanswered_requests($1)', [city])).rowCount,
  ).toBe(0);
});

test('foto é atômica, privada, editável somente antes de receber indicação, removível e não aparece nos cards', async () => {
  const id = (
    await rpc(owner, 'select public.create_request_with_photo($1,$2,null,$3) id', [
      'Peça com foto',
      city,
      jpeg,
    ])
  ).rows[0].id;
  expect(
    (await rpc(visitor, 'select public.request_photo($1) photo', [id])).rows[0].photo.replaceAll(
      '\n',
      '',
    ),
  ).toBe(jpeg);
  expect(
    (await rpc(visitor, 'select has_photo from public.requests where id=$1', [id])).rows[0]
      .has_photo,
  ).toBe(true);
  await expect(rpc(visitor, 'select * from private.request_photos')).rejects.toThrow(
    'permission denied',
  );
  await expect(
    rpc(visitor, 'select public.edit_request_with_photo($1,$2,$3,null,null,true)', [
      id,
      'Texto alterado',
      city,
    ]),
  ).rejects.toThrow('NOT_ALLOWED');
  await rpc(owner, 'select public.edit_request_with_photo($1,$2,$3,null,null,true)', [
    id,
    'Peça sem foto',
    city,
  ]);
  expect(
    (await rpc(visitor, 'select public.request_photo($1) photo', [id])).rows[0].photo,
  ).toBeNull();
  await rpc(owner, 'select public.edit_request_with_photo($1,$2,$3,null,$4)', [
    id,
    'Peça com nova foto',
    city,
    jpeg,
  ]);
  await indicate(id);
  await expect(
    rpc(owner, 'select public.edit_request_with_photo($1,$2,$3,null,null,true)', [
      id,
      'Texto alterado',
      city,
    ]),
  ).rejects.toThrow('EDIT_LOCKED');
  const before = (await db.pool.query('select count(*)::int n from public.requests')).rows[0].n;
  await expect(
    rpc(owner, 'select public.create_request_with_photo($1,$2,null,$3)', [
      'Foto inválida',
      city,
      'invalid',
    ]),
  ).rejects.toThrow('INVALID_PHOTO');
  expect((await db.pool.query('select count(*)::int n from public.requests')).rows[0].n).toBe(
    before,
  );
  await rpc(admin, "select public.admin_moderate('HIDE_REQUEST',$1)", [id]);
  await expect(rpc(visitor, 'select public.request_photo($1)', [id])).rejects.toThrow(
    'NOT_ALLOWED',
  );
  await expect(db.as('anon', null, 'select public.request_photo($1)', [id])).rejects.toThrow(
    'permission denied',
  );
});
test('novas leituras funcionam em transação somente leitura e rejeitam bloqueio e ausência de perfil', async () => {
  const client = await db.pool.connect();
  try {
    await client.query('begin read only');
    await client.query('set local role authenticated');
    await client.query("select set_config('request.jwt.claim.sub',$1,true)", [visitor]);
    await client.query('select * from public.search_unanswered_requests($1)', [city]);
    await client.query('select public.request_photo($1)', [request]);
    await client.query('commit');
  } finally {
    await client.query('rollback');
    client.release();
  }
  const pending = randomUUID();
  await db.pool.query('insert into auth.users(id) values($1)', [pending]);
  await expect(
    rpc(pending, 'select * from public.search_unanswered_requests($1)', [city]),
  ).rejects.toThrow('ONBOARDING_REQUIRED');
  await rpc(admin, "select public.admin_moderate('BLOCK_USER',$1)", [visitor]);
  await expect(rpc(visitor, 'select public.reconfirm_discovery($1)', [request])).rejects.toThrow(
    'ACCOUNT_BLOCKED',
  );
  await expect(rpc(visitor, 'select public.request_photo($1)', [request])).rejects.toThrow(
    'ACCOUNT_BLOCKED',
  );
});
test('exporta novos dados próprios e encerra conta apagando fotos, alertas, reconfirmações e interesse', async () => {
  await rpc(owner, 'select public.edit_request_with_photo($1,$2,$3,null,$4)', [
    request,
    'Peça com foto',
    city,
    jpeg,
  ]);
  await resolve();
  await rpc(visitor, 'select public.reconfirm_discovery($1)', [request]);
  const pending = await create();
  await rpc(visitor, 'select public.set_request_wanted($1,true)', [pending]);
  await rpc(visitor, "select public.add_topic_alert($1,'café')", [city]);
  const own = (await rpc(owner, 'select public.export_account() data')).rows[0].data;
  expect(own.photos).toHaveLength(1);
  expect(own.reconfirmations).toEqual([]);
  const theirs = (await rpc(visitor, 'select public.export_account() data')).rows[0].data;
  expect(theirs.photos).toEqual([]);
  expect(theirs.topic_alerts).toHaveLength(1);
  expect(theirs.reconfirmations).toHaveLength(1);
  for (const user of [visitor, owner]) {
    const support = (
      await rpc(
        user,
        "select public.request_support('CLOSE_ACCOUNT','Quero encerrar meus dados pessoais') id",
      )
    ).rows[0].id;
    await rpc(admin, 'select public.prepare_account_closure($1)', [support]);
    await rpc(
      admin,
      "select public.complete_account_closure($1,'Conta encerrada com todos os dados adicionais')",
      [support],
    );
  }
  expect((await db.pool.query('select * from private.request_photos')).rowCount).toBe(0);
  expect((await db.pool.query('select * from public.topic_alerts')).rowCount).toBe(0);
  const counts = (
    await db.pool.query(
      'select reconfirmation_count,last_reconfirmed_at,has_photo from public.requests where id=$1',
      [request],
    )
  ).rows[0];
  expect(counts).toEqual({ reconfirmation_count: 0, last_reconfirmed_at: null, has_photo: false });
  expect(
    (await db.pool.query('select wanting_count from public.requests where id=$1', [pending]))
      .rows[0].wanting_count,
  ).toBe(0);
  expect((await db.pool.query('select points from public.reward_events')).rows).toEqual([
    { points: 10 },
  ]);
  await expect(rpc(admin, 'select public.export_account_before_discovery()')).rejects.toThrow(
    'permission denied',
  );
});
