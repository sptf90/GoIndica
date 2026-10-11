import { testDatabase } from '../tests/integration/database';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import sharp from 'sharp';
if (process.env.TEST_DATABASE_URL)
  throw new Error('O contrato HTTP usa somente banco temporário. Remova TEST_DATABASE_URL.');
const db = await testDatabase(),
  secret = randomBytes(32).toString('hex');
let app: ReturnType<typeof spawn> | undefined;
try {
  const owner = randomUUID(),
    helper = randomUUID(),
    admin = randomUUID();
  for (const [index, id] of [owner, helper, admin].entries()) {
    await db.pool.query('insert into auth.users(id) values($1)', [id]);
    await db.as('authenticated', id, 'select public.save_profile($1,$2,3549805,false)', [
      'rest_' + index,
      'Contrato ' + index,
    ]);
  }
  await db.pool.query('update private.accounts set is_admin=true where id=$1', [admin]);
  const socket = createServer();
  await new Promise<void>((r) => socket.listen(0, '127.0.0.1', r));
  const address = socket.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const port = address.port;
  await new Promise<void>((r) => socket.close(() => r()));
  const uri = new URL('postgresql://127.0.0.1/postgres');
  uri.port = String(db.pool.options.port);
  uri.username = 'postgres';
  uri.password = String(db.pool.options.password);
  app = spawn(process.env.POSTGREST_BIN || 'postgrest', [], {
    stdio: 'ignore',
    env: {
      ...process.env,
      PGRST_DB_URI: uri.toString(),
      PGRST_DB_SCHEMAS: 'public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: secret,
      PGRST_SERVER_HOST: '127.0.0.1',
      PGRST_SERVER_PORT: String(port),
    },
  });
  let startupError = false;
  app.on('error', () => {
    startupError = true;
  });
  const base = 'http://127.0.0.1:' + port;
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (startupError || app.exitCode !== null)
      throw new Error('PostgREST não iniciou. Instale o binário ou defina POSTGREST_BIN.');
    try {
      ready = (await fetch(base, { signal: AbortSignal.timeout(500) })).ok;
    } catch {
      /* Wait for the isolated HTTP server. */
    }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(ready, true);
  function token(id: string) {
    const data =
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url') +
      '.' +
      Buffer.from(
        JSON.stringify({
          sub: id,
          role: 'authenticated',
          exp: Math.floor(Date.now() / 1000) + 300,
        }),
      ).toString('base64url');
    return data + '.' + createHmac('sha256', secret).update(data).digest('base64url');
  }
  const rpc = (name: string, actor: string, body: Record<string, unknown> = {}) =>
    fetch(base + '/rpc/' + name, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token(actor), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  assert.equal(
    (await rpc('add_topic_alert', helper, { p_city_id: 3549805, p_term: 'café Caputo' })).status,
    204,
  );
  const photo = (
    await sharp({ create: { width: 40, height: 30, channels: 3, background: '#347d25' } })
      .jpeg()
      .toBuffer()
  ).toString('base64');
  const created = await rpc('create_request_with_photo', owner, {
    p_description: 'Peça de reposição para máquina de café Caputo',
    p_city_id: 3549805,
    p_photo: photo,
  });
  assert.equal(created.status, 200);
  const id = await created.json();
  const storedPhoto = await rpc('request_photo', helper, { p_request_id: id });
  assert.equal(storedPhoto.status, 200);
  assert.equal((await storedPhoto.json()).replaceAll('\n', ''), photo);
  assert.equal(
    (await rpc('set_request_wanted', helper, { p_request_id: id, p_wanted: true })).status,
    204,
  );
  const unanswered = await rpc('search_unanswered_requests', helper, { p_city_id: 3549805 });
  assert.equal(unanswered.status, 200);
  assert.equal((await unanswered.json())[0].wanting_count, 1);
  const inbox = await fetch(base + '/notifications?kind=eq.TOPIC_MATCH', {
    headers: { Authorization: 'Bearer ' + token(helper) },
  });
  assert.equal((await inbox.json()).length, 1);
  const search = await rpc('search_requests', helper, {
    p_city_id: 3549805,
    p_query: 'cafe reposicao',
    p_status: 'OPEN',
  });
  assert.equal(search.status, 200);
  const rows = await search.json();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, id);
  const brands = await rpc('search_requests', helper, {
    p_city_id: 3549805,
    p_query: '"cafe" Caputo',
    p_status: 'OPEN',
  });
  assert.equal((await brands.json()).length, 1);
  const metrics = await rpc('admin_metrics', admin, {
    p_city_id: 3549805,
    p_since: '2020-01-01T00:00:00Z',
  });
  assert.equal(metrics.status, 200);
  assert.equal((await metrics.json()).requests, 1);
  assert.ok((await rpc('admin_metrics', helper)).status >= 400);
  const anonymous = await fetch(base + '/rpc/search_requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_city_id: 3549805 }),
  });
  assert.ok(anonymous.status >= 400);
  await db.as(
    'service_role',
    null,
    "select public.submit_verified_indication($1,$2,'rest_place',3549805)",
    [helper, id],
  );
  assert.equal((await rpc('reveal_responses', owner, { p_request_id: id })).status, 204);
  const place = (await db.pool.query('select id from public.places limit 1')).rows[0].id;
  const resolved = await rpc('resolve_request', owner, {
    p_request_id: id,
    p_type: 'INDICATED_PLACE',
    p_place_id: place,
  });
  assert.equal(resolved.status, 200);
  assert.equal((await rpc('reconfirm_discovery', helper, { p_request_id: id })).status, 204);
  assert.equal(
    (await rpc('search_unanswered_requests', helper, { p_city_id: 3549805 })).status,
    200,
  );
  const own = await rpc('export_account', helper);
  assert.equal(own.status, 200);
  const exported = await own.json();
  assert.equal(exported.topic_alerts.length, 1);
  assert.equal(exported.reconfirmations.length, 1);
  assert.equal(exported.photos.length, 0);
  await rpc('admin_moderate', admin, {
    p_action: 'HIDE_REQUEST',
    p_target_id: id,
    p_note: 'Removido no ensaio de contrato HTTP',
  });
  const hidden = await rpc('search_requests', helper, { p_city_id: 3549805, p_query: 'cafe' });
  assert.deepEqual(await hidden.json(), []);
  console.log(
    'PostgREST real: busca, fotos, interesse, alertas, reconfirmações, exportação, métricas e autorização aprovados.',
  );
} finally {
  if (app && app.exitCode === null) {
    app.kill('SIGTERM');
    await Promise.race([once(app, 'exit'), new Promise<void>((r) => setTimeout(r, 2000))]);
    if (app.exitCode === null) app.kill('SIGKILL');
  }
  await db.stop();
}
