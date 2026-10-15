import { testDatabase } from '../tests/integration/database';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
if (process.env.TEST_DATABASE_URL)
  throw new Error('Este ensaio usa somente banco temporário. Remova TEST_DATABASE_URL.');
const db = await testDatabase();
try {
  const owner = randomUUID(),
    helper = randomUUID(),
    admin = randomUUID();
  for (const [index, id] of [owner, helper, admin].entries()) {
    await db.pool.query('insert into auth.users(id) values($1)', [id]);
    await db.as('authenticated', id, 'select public.save_profile($1,$2,3549805,false)', [
      'scale_' + index,
      'Ensaio ' + index,
    ]);
  }
  await db.pool.query('update private.accounts set is_admin=true where id=$1', [admin]);
  await db.pool.query(
    "insert into public.requests(requester_id,description,city_id,created_at) select $1,case when n%1000=0 then 'Peça especial para máquina de café' else 'Produto comum da cidade '||n end,3549805,now()-n*interval '1 minute' from generate_series(1,10000) n",
    [owner],
  );
  await db.pool.query(
    "insert into public.places(google_place_id,city_id) values('scale_place',3549805)",
  );
  await db.pool.query(
    'insert into public.indications(request_id,user_id,place_id) select r.id,$1,p.id from public.requests r cross join public.places p order by r.created_at limit 1000',
    [helper],
  );
  await db.pool.query(
    'analyze public.requests; analyze public.indications; analyze public.notifications;',
  );
  const measured: Record<string, number> = {};
  async function time<T>(name: string, fn: () => Promise<T>) {
    const start = performance.now();
    const result = await fn();
    measured[name] = Math.round((performance.now() - start) * 100) / 100;
    return result;
  }
  const search = await time('search_ms', () =>
    db.as(
      'authenticated',
      helper,
      "select * from public.search_requests(3549805,'reposicao OR cafe','OPEN',0)",
    ),
  );
  assert.equal(search.rowCount, 10);
  const first = await time('feed_ms', () =>
    db.as('authenticated', helper, "select id from public.search_requests(3549805,'','OPEN',0)"),
  );
  const next = await time('pagination_ms', () =>
    db.as('authenticated', helper, "select id from public.search_requests(3549805,'','OPEN',20)"),
  );
  assert.equal(first.rowCount, 21);
  assert.equal(next.rowCount, 21);
  assert.equal(first.rows[20].id, next.rows[0].id);
  const unanswered = await time('unanswered_ms', () =>
    db.as('authenticated', helper, 'select id from public.search_unanswered_requests(3549805)'),
  );
  assert.equal(unanswered.rowCount, 21);
  const unansweredPlan = await db.pool.query(
    "explain (analyze,format json) select id from public.requests where city_id=3549805 and status='OPEN' and indication_count=0 and hidden_at is null order by created_at,id limit 21",
  );
  assert.match(JSON.stringify(unansweredPlan.rows), /requests_unanswered/);
  const metrics = await time('metrics_ms', () =>
    db.as('authenticated', admin, 'select public.admin_metrics(3549805) m'),
  );
  assert.equal(metrics.rows[0].m.requests, 10000);
  assert.equal(metrics.rows[0].m.with_indications, 1000);
  await time('ranking_ms', () =>
    db.as('authenticated', helper, 'select * from public.city_ranking(3549805)'),
  );
  const plan = await db.pool.query(
    "explain (analyze,format json) select id from public.requests where city_id=3549805 and status='OPEN' and hidden_at is null and to_tsvector('portuguese',public.search_text(description)) @@ websearch_to_tsquery('portuguese',public.search_text('cafe'))",
  );
  const document = plan.rows[0]['QUERY PLAN'];
  assert.match(JSON.stringify(document), /requests_search/);
  console.log(
    JSON.stringify(
      { requests: 10000, indications: 1000, ...measured, index: 'requests_search', plan: document },
      null,
      2,
    ),
  );
} finally {
  await db.stop();
}
