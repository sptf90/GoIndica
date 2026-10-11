import { testDatabase } from '../tests/integration/database';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, chmod } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import sharp from 'sharp';
const run = promisify(execFile);
if (process.env.TEST_DATABASE_URL)
  throw new Error('Restauração usa somente bancos temporários. Remova TEST_DATABASE_URL.');
const directory = await mkdtemp(join(tmpdir(), 'goindica-recovery-'));
await chmod(directory, 0o700);
const source = await testDatabase();
let target: Awaited<ReturnType<typeof testDatabase>> | undefined;
try {
  const owner = randomUUID(),
    a = randomUUID(),
    b = randomUUID();
  for (const [index, id] of [owner, a, b].entries()) {
    await source.pool.query('insert into auth.users(id) values($1)', [id]);
    await source.as('authenticated', id, 'select public.save_profile($1,$2,3549805,false)', [
      'recovery_' + index,
      'Recuperação ' + index,
    ]);
  }
  const photo = (
    await sharp({ create: { width: 40, height: 30, channels: 3, background: '#347d25' } })
      .jpeg()
      .toBuffer()
  ).toString('base64');
  await source.as(
    'authenticated',
    a,
    "select public.add_topic_alert(3549805,'restauração recompensas')",
  );
  const id = (
    await source.as(
      'authenticated',
      owner,
      "select public.create_request_with_photo('Ensaio de restauração de recompensas',3549805,null,$1) id",
      [photo],
    )
  ).rows[0].id;
  await source.as('authenticated', b, 'select public.set_request_wanted($1,true)', [id]);
  for (const person of [a, b])
    await source.as(
      'service_role',
      null,
      "select public.submit_verified_indication($1,$2,'recovery_place',3549805)",
      [person, id],
    );
  const place = (await source.pool.query('select id from public.places')).rows[0].id;
  await source.as('authenticated', owner, 'select public.reveal_responses($1)', [id]);
  await source.as(
    'authenticated',
    owner,
    "select public.resolve_request($1,'INDICATED_PLACE',$2)",
    [id, place],
  );
  await source.as('authenticated', a, 'select public.reconfirm_discovery($1)', [id]);
  const discoveries = async (db: typeof source) =>
    (
      await db.pool.query(`select jsonb_build_object(
   'requests',(select jsonb_agg(to_jsonb(r) order by id) from public.requests r),
   'photos',(select jsonb_agg(jsonb_build_object('request_id',request_id,'jpeg',encode(jpeg,'base64'))) from private.request_photos),
   'topics',(select jsonb_agg(to_jsonb(t) order by id) from public.topic_alerts t),
   'reconfirmations',(select jsonb_agg(to_jsonb(c) order by user_id) from public.request_reconfirmations c),
   'interests',(select jsonb_agg(to_jsonb(i) order by user_id) from public.request_interests i)
  ) data`)
    ).rows[0].data;
  const discoveryBefore = await discoveries(source);
  const before = (
    await source.pool.query('select to_jsonb(e) row from public.reward_events e order by id')
  ).rows;
  const backup = join(directory, 'backup.dump');
  const dump = process.env.PG_DUMP_BIN || 'pg_dump',
    restore = process.env.PG_RESTORE_BIN || 'pg_restore';
  const args = (db: typeof source) => [
    '--host',
    String(db.pool.options.host),
    '--port',
    String(db.pool.options.port),
    '--username',
    'postgres',
    '--dbname',
    'postgres',
  ];
  await run(dump, [...args(source), '--format=custom', '--no-owner', '--file', backup], {
    env: { ...process.env, PGPASSWORD: String(source.pool.options.password) },
    maxBuffer: 1024 * 1024,
  });
  await chmod(backup, 0o600);
  target = await testDatabase();
  await target.pool.query(
    'drop schema public cascade; drop schema private cascade; drop schema auth cascade; create schema public;',
  );
  await run(restore, [...args(target), '--exit-on-error', '--no-owner', backup], {
    env: { ...process.env, PGPASSWORD: String(target.pool.options.password) },
    maxBuffer: 1024 * 1024,
  });
  const after = (
    await target.pool.query('select to_jsonb(e) row from public.reward_events e order by id')
  ).rows;
  assert.deepEqual(after, before);
  assert.deepEqual(await discoveries(target), discoveryBefore);
  assert.equal(
    (
      await target.as('authenticated', a, 'select public.request_photo($1) photo', [id])
    ).rows[0].photo.replaceAll('\n', ''),
    photo,
  );
  assert.equal(after.length, 2);
  assert.equal(
    (await target.as('authenticated', a, "select public.profile_stats('recovery_1') s")).rows[0].s
      .points,
    10,
  );
  assert.equal(
    (await target.as('authenticated', owner, 'select * from public.indications')).rowCount,
    2,
  );
  await assert.rejects(
    target.as('authenticated', a, 'delete from public.reward_events'),
    /permission denied/,
  );
  await assert.rejects(
    target.pool.query('update public.reward_events set points=20'),
    /IMMUTABLE_LEDGER/,
  );
  console.log(
    'Backup restaurado: fotos, alertas, reconfirmações, interesse e 2 recompensas idênticos; RLS e ledger preservados.',
  );
} finally {
  await target?.stop();
  await source.stop();
  await rm(directory, { recursive: true, force: true });
}
