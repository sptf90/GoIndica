import EmbeddedPostgres from 'embedded-postgres';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
  return address.port;
}
export async function testDatabase() {
  let pg: EmbeddedPostgres | undefined;
  let directory: string | undefined;
  let pool: Pool;
  const connectionsEnding = new Set<Promise<void>>();
  if (process.env.TEST_DATABASE_URL) {
    const url = new URL(process.env.TEST_DATABASE_URL);
    if (!url.pathname.endsWith('_test'))
      throw new Error('TEST_DATABASE_URL must point to a dedicated database ending in _test.');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  } else {
    directory = await mkdtemp(join(tmpdir(), 'descoberta-pg-'));
    const password = randomBytes(24).toString('hex');
    const port = await freePort();
    pg = new EmbeddedPostgres({
      databaseDir: directory,
      user: 'postgres',
      password,
      port,
      persistent: false,
      onLog: () => {},
      onError: () => {},
    });
    await pg.initialise();
    await pg.start();
    pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres' });
  }
  pool.on('connect', (client) => {
    const closed = new Promise<void>((resolve) => client.once('end', resolve));
    connectionsEnding.add(closed);
    void closed.then(() => connectionsEnding.delete(closed));
  });
  async function closePool() {
    // pg-pool removes idle clients before their socket close completes.
    // Wait for those connections before stopping the disposable server.
    await pool.end();
    await Promise.all([...connectionsEnding]);
  }
  try {
    const existing = await pool.query("select to_regclass('public.requests') as existing");
    if (existing.rows[0].existing)
      throw new Error('Test database must be empty. Refusing to modify existing data.');
    await pool.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if; end $$;
 create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;`);
    for (const file of (await readdir('supabase/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort())
      await pool.query(await readFile(join('supabase/migrations', file), 'utf8'));
  } catch (e) {
    await closePool();
    await pg?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
    throw e;
  }
  async function as<T extends QueryResultRow = QueryResultRow>(
    role: 'anon' | 'authenticated' | 'service_role',
    actor: string | null,
    sql: string,
    args: unknown[] = [],
  ) {
    const client = await pool.connect();
    try {
      await identity(client, role, actor);
      const result = await client.query<T>(sql, args);
      await client.query('commit');
      return result;
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  return {
    pool,
    as,
    async stop() {
      await closePool();
      await pg?.stop();
      if (directory) await rm(directory, { recursive: true, force: true });
    },
  };
}
export async function identity(
  client: PoolClient,
  role: 'anon' | 'authenticated' | 'service_role',
  actor: string | null,
) {
  await client.query('begin');
  await client.query(`set local role ${role}`);
  await client.query("select set_config('request.jwt.claim.sub',$1,true)", [actor || '']);
}
