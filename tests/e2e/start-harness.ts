// Disposable PostgreSQL + minimal Supabase HTTP protocol fixture for browser tests.
// No test endpoints or transport fixtures are part of src/ or the production build.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomUUID, randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { testDatabase } from '../integration/database';
import { types } from 'pg';
// PostgREST serializa bigint como número JSON; o driver pg usa string por padrão.
types.setTypeParser(20, Number);
const db = await testDatabase();
const signingKey = randomBytes(32);
const serviceKey = randomBytes(32).toString('hex');
const port = 3456;
type TestUser = {
  id: string;
  name: string;
  email: string;
  provider?: 'email' | 'google';
  passwordHash?: string;
  confirmed?: boolean;
  deletedAt?: string;
};
const users = new Map<string, TestUser>();
const mailbox = new Map<
  string,
  { user: string; tokenHash: string; type: 'email' | 'recovery'; redirectTo?: string }
>();
const passwordHash = (password: string) =>
  createHmac('sha256', signingKey).update(password).digest('hex');
const authorizations = new Map<string, { challenge: string; redirect: string }>();
const codes = new Map<string, { challenge: string; user: string }>();
for (const name of [
  'Ana',
  'João',
  'Maria',
  'Carlos',
  'Administrador',
  'Sofia',
  'Bruno',
  'Lia',
  'NinaFirefox',
  'NinaWebkit',
  'Paula',
  'Diego',
  'Rita',
]) {
  const id = randomUUID();
  users.set(id, { id, name, email: name.toLowerCase() + '@test.invalid' });
  await db.pool.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
    id,
    { full_name: name },
  ]);
  if (name === 'Administrador')
    await db.pool.query('update private.accounts set is_admin=true where id=$1', [id]);
}
const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('X-Supabase-Api-Version', '2024-01-01');
  res.end(JSON.stringify(data));
};
async function body(req: IncomingMessage) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 750000) throw new Error('BODY_TOO_LARGE');
  }
  return text ? (JSON.parse(text) as Record<string, unknown>) : {};
}
function jwt(userId: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(
    JSON.stringify({
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
      iss: `http://localhost:${port}/auth/v1`,
    }),
  ).toString('base64url');
  const data = header + '.' + claims;
  return data + '.' + createHmac('sha256', signingKey).update(data).digest('base64url');
}
function userFromToken(token: string) {
  try {
    const parts = token.split('.');
    const signature = createHmac('sha256', signingKey)
      .update(parts[0] + '.' + parts[1])
      .digest();
    const supplied = Buffer.from(parts[2], 'base64url');
    if (signature.length !== supplied.length || !timingSafeEqual(signature, supplied)) return null;
    const claim = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as {
      sub: string;
      exp: number;
    };
    return claim.exp > Date.now() / 1000 ? users.get(claim.sub) : null;
  } catch {
    return null;
  }
}
function authUser(u: TestUser) {
  const provider = u.provider || 'google';
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    app_metadata: { provider, providers: [provider] },
    user_metadata: { full_name: u.name },
    identities: [{ id: u.id, user_id: u.id, provider, identity_data: { sub: u.id } }],
    deleted_at: u.deletedAt,
    created_at: new Date().toISOString(),
  };
}
function tokenResponse(u: TestUser) {
  return {
    access_token: jwt(u.id),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: randomUUID(),
    user: authUser(u),
  };
}
const tables = new Set([
  'cities',
  'profiles',
  'requests',
  'places',
  'indications',
  'request_resolutions',
  'reward_events',
  'reports',
  'audit_logs',
  'notifications',
  'request_interests',
  'user_preferences',
  'followed_cities',
  'support_requests',
  'topic_alerts',
  'request_reconfirmations',
]);
const functions: Record<string, string[]> = {
  request_editable: ['p_request_id'],
  account_state: [],
  is_admin: [],
  save_profile: ['p_username', 'p_display_name', 'p_city_id', 'p_use_google_photo'],
  log_login: [],
  consume_api_limit: ['p_bucket'],
  create_request: ['p_description', 'p_city_id', 'p_neighborhood'],
  create_request_with_photo: ['p_description', 'p_city_id', 'p_neighborhood', 'p_photo'],
  edit_request_with_photo: [
    'p_request_id',
    'p_description',
    'p_city_id',
    'p_neighborhood',
    'p_photo',
    'p_remove_photo',
  ],
  request_photo: ['p_request_id'],
  consume_share_card_limit: [],
  set_request_wanted: ['p_request_id', 'p_wanted'],
  reconfirm_discovery: ['p_request_id'],
  add_topic_alert: ['p_city_id', 'p_term'],
  remove_topic_alert: ['p_id'],
  search_unanswered_requests: ['p_city_id', 'p_query', 'p_offset'],
  edit_request: ['p_request_id', 'p_description', 'p_city_id', 'p_neighborhood'],
  submit_verified_indication: [
    'p_actor',
    'p_request_id',
    'p_google_place_id',
    'p_verified_city_id',
    'p_comment',
  ],
  reveal_responses: ['p_request_id'],
  resolve_request: ['p_request_id', 'p_type', 'p_place_id'],
  cancel_request: ['p_request_id'],
  report_content: ['p_target_type', 'p_target_id', 'p_reason'],
  admin_moderate: ['p_action', 'p_target_id', 'p_note'],
  admin_accounts: ['p_search', 'p_offset'],
  city_ranking: ['p_city_id', 'p_offset'],
  profile_stats: ['p_username'],
  admin_metrics: ['p_city_id', 'p_since', 'p_until'],
  search_requests: ['p_city_id', 'p_query', 'p_status', 'p_offset'],
  record_search_event: ['p_kind', 'p_city_id', 'p_request_id'],
  set_request_interest: ['p_request_id', 'p_saved', 'p_following'],
  save_preferences: ['p_email_reminders'],
  set_followed_city: ['p_city_id', 'p_following'],
  mark_notifications_read: ['p_id'],
  member_summary: [],
  refresh_reminders: [],
  request_support: ['p_kind', 'p_reason'],
  admin_review_support: ['p_id', 'p_decision', 'p_note'],
  prepare_account_closure: ['p_id'],
  complete_account_closure: ['p_id', 'p_note'],
  export_account: [],
  admin_operations: [],
  health_check: [],
  record_analytics: ['p_event', 'p_fingerprint'],
  indication_groups: ['p_request_id', 'p_offset'],
};
const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://localhost:${port}`);
    if (url.pathname === '/health') {
      json(res, { ready: true });
      return;
    }
    if (url.pathname === '/test-mail') {
      const email = url.searchParams.get('email') || '';
      json(res, mailbox.get(email) || null);
      return;
    }
    if (url.pathname === '/auth/v1/signup') {
      const input = await body(req);
      const email = String(input.email);
      if ([...users.values()].some((u) => u.email === email)) {
        json(res, { code: 'user_already_exists', msg: 'User already registered' }, 422);
        return;
      }
      const u: TestUser = {
        id: randomUUID(),
        name: '',
        email,
        provider: 'email',
        passwordHash: passwordHash(String(input.password)),
        confirmed: false,
      };
      users.set(u.id, u);
      await db.pool.query('insert into auth.users(id,raw_user_meta_data) values($1,$2)', [
        u.id,
        {},
      ]);
      mailbox.set(email, {
        user: u.id,
        tokenHash: randomBytes(32).toString('hex'),
        type: 'email',
        redirectTo: url.searchParams.get('redirect_to') || undefined,
      });
      json(res, authUser(u));
      return;
    }
    if (url.pathname === '/auth/v1/recover') {
      const input = await body(req);
      const u = [...users.values()].find((u) => u.email === input.email);
      if (u)
        mailbox.set(u.email, {
          user: u.id,
          tokenHash: randomBytes(32).toString('hex'),
          type: 'recovery',
        });
      json(res, {});
      return;
    }
    if (url.pathname === '/auth/v1/verify') {
      const input = await body(req);
      const mail = [...mailbox.values()].find(
        (m) => m.tokenHash === input.token_hash && m.type === input.type,
      );
      const u = mail ? users.get(mail.user) : undefined;
      if (!u || !mail) {
        json(res, { code: 'otp_expired', msg: 'Token expired' }, 403);
        return;
      }
      mailbox.delete(u.email);
      u.confirmed = true;
      json(res, tokenResponse(u));
      return;
    }
    if (url.pathname === '/auth/v1/authorize') {
      const token = randomUUID();
      authorizations.set(token, {
        challenge: url.searchParams.get('code_challenge') || '',
        redirect: url.searchParams.get('redirect_to') || 'http://localhost:3100/auth/callback',
      });
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(
        `<main><h1>Google OAuth — ambiente de teste</h1><p>Selecione uma identidade de teste.</p>${[...users.values()].map((u) => `<p><a href="/test-login?transaction=${token}&user=${u.id}">${u.name}</a></p>`).join('')}</main>`,
      );
      return;
    }
    if (url.pathname === '/test-login') {
      const tx = authorizations.get(url.searchParams.get('transaction') || '');
      const user = url.searchParams.get('user') || '';
      if (!tx || !users.has(user)) throw new Error('AUTH_REQUIRED');
      const code = randomUUID();
      codes.set(code, { challenge: tx.challenge, user });
      const redirect = new URL(tx.redirect);
      redirect.searchParams.set('code', code);
      res.writeHead(302, { Location: redirect.toString() });
      res.end();
      return;
    }
    if (url.pathname === '/auth/v1/token') {
      const input = await body(req);
      if (url.searchParams.get('grant_type') === 'password') {
        const u = [...users.values()].find((u) => u.email === input.email);
        if (!u || !u.passwordHash || u.passwordHash !== passwordHash(String(input.password))) {
          json(res, { code: 'invalid_credentials', msg: 'Invalid login credentials' }, 400);
          return;
        }
        if (!u.confirmed) {
          json(res, { code: 'email_not_confirmed', msg: 'Email not confirmed' }, 400);
          return;
        }
        json(res, tokenResponse(u));
        return;
      }
      const code = codes.get(String(input.auth_code));
      if (
        !code ||
        createHash('sha256').update(String(input.code_verifier)).digest('base64url') !==
          code.challenge
      ) {
        json(res, { error: 'invalid_grant', msg: 'Invalid PKCE verifier' }, 400);
        return;
      }
      codes.delete(String(input.auth_code));
      const u = users.get(code.user)!;
      json(res, tokenResponse(u));
      return;
    }
    const bearer = req.headers.authorization?.replace(/^Bearer /, '') || '';
    const user = userFromToken(bearer);
    if (url.pathname.startsWith('/auth/v1/admin/users/') && bearer === serviceKey) {
      const target = users.get(url.pathname.split('/').pop()!);
      if (!target) {
        json(res, { message: 'User not found' }, 404);
        return;
      }
      if (req.method === 'DELETE') {
        const input = await body(req);
        if (!input.should_soft_delete) throw new Error('Soft deletion required');
        target.deletedAt = new Date().toISOString();
        target.name = 'Conta encerrada';
        target.email = 'closed-' + target.id + '@test.invalid';
        await db.pool.query("update auth.users set raw_user_meta_data='{}' where id=$1", [
          target.id,
        ]);
      }
      if (req.method === 'PUT') {
        const input = await body(req);
        if (input.email) target.email = String(input.email);
        if (input.user_metadata) target.name = 'Conta encerrada';
      }
      json(res, authUser(target));
      return;
    }
    if (url.pathname === '/auth/v1/user') {
      if (!user) {
        json(res, { message: 'Unauthorized' }, 401);
        return;
      }
      if (req.method === 'PUT') {
        const input = await body(req);
        if (input.password) user.passwordHash = passwordHash(String(input.password));
        if (input.email) user.email = String(input.email);
      }
      json(res, authUser(user));
      return;
    }
    if (url.pathname === '/auth/v1/logout') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (url.pathname === '/test-scenario' && req.method === 'POST' && user) {
      const request = (
        await db.as(
          'authenticated',
          user.id,
          "select public.create_request('Paginação independente dos estabelecimentos',3549805) id",
        )
      ).rows[0].id;
      for (let i = 0; i < 26; i++) {
        const id = randomUUID();
        await db.pool.query('insert into auth.users(id) values($1)', [id]);
        await db.as('authenticated', id, 'select public.save_profile($1,$2,3549805,false)', [
          'pagination_' + id.replaceAll('-', '').slice(0, 10),
          'Participante ' + String(i).padStart(2, '0'),
        ]);
        await db.as(
          'service_role',
          null,
          'select public.submit_verified_indication($1,$2,$3,3549805,$4)',
          [
            id,
            request,
            i === 25 ? 'test_place_b' : 'test_place_a',
            i === 25 ? 'Participante do segundo local' : 'Participante do primeiro local',
          ],
        );
      }
      json(res, { id: request });
      return;
    }
    if (!url.pathname.startsWith('/rest/v1/')) {
      json(res, { error: 'Not found' }, 404);
      return;
    }
    const role = bearer === serviceKey ? 'service_role' : user ? 'authenticated' : 'anon';
    const actor = user?.id || null;
    const resource = url.pathname.replace('/rest/v1/', '');
    if (resource.startsWith('rpc/')) {
      const fn = resource.slice(4);
      if (!(fn in functions)) throw new Error('NOT_ALLOWED');
      const input = await body(req);
      const argNames = functions[fn].filter((k) => input[k] !== undefined);
      const values = argNames.map((k) => input[k]);
      const args = argNames.map((k, i) => `${k}=>$${i + 1}`).join(',');
      const result = await db.as(role, actor, `select * from public.${fn}(${args})`, values);
      const scalar = [
        'request_editable',
        'account_state',
        'is_admin',
        'create_request',
        'create_request_with_photo',
        'request_photo',
        'submit_verified_indication',
        'resolve_request',
        'profile_stats',
        'admin_metrics',
        'member_summary',
        'export_account',
        'admin_operations',
        'health_check',
        'request_support',
        'prepare_account_closure',
      ].includes(fn);
      const value = scalar
        ? (result.rows[0]?.[fn] ?? null)
        : [
              'city_ranking',
              'admin_accounts',
              'indication_groups',
              'search_requests',
              'search_unanswered_requests',
            ].includes(fn)
          ? result.rows
          : null;
      json(res, value);
      return;
    }
    if (!tables.has(resource)) throw new Error('NOT_ALLOWED');
    const columns = (
      await db.pool.query(
        'select column_name from information_schema.columns where table_schema=$1 and table_name=$2',
        ['public', resource],
      )
    ).rows.map((r) => String(r.column_name));
    const values: unknown[] = [];
    const param = (v: unknown) => {
      values.push(v);
      return '$' + values.length;
    };
    const identifier = (v: string) => {
      if (!columns.includes(v)) throw new Error('Invalid column');
      return '"' + v + '"';
    };
    const where: string[] = [];
    for (const [key, filter] of url.searchParams) {
      if (['select', 'order', 'limit', 'offset'].includes(key)) continue;
      if (key === 'or') {
        if (filter !== '(status.eq.REVEALED,and(status.eq.OPEN,indication_count.gt.0))')
          throw new Error('Unsupported fixture filter');
        where.push("(status='REVEALED' or (status='OPEN' and indication_count>0))");
        continue;
      }
      const column = identifier(key);
      const dot = filter.indexOf('.');
      const op = filter.slice(0, dot),
        value = filter.slice(dot + 1);
      if (op === 'eq') where.push(column + '=' + param(value));
      else if (op === 'is' && value === 'null') where.push(column + ' is null');
      else if (op === 'gt') where.push(column + '>' + param(value));
      else if (op === 'ilike') where.push(column + ' ilike ' + param(value));
      else if (op === 'in') {
        const arr = value
          .replace(/^\(|\)$/g, '')
          .split(',')
          .map((s) => s.replace(/^"|"$/g, ''));
        where.push(column + ' in (' + arr.map((s) => param(s)).join(',') + ')');
      } else if (op.startsWith('wfts'))
        where.push(
          `to_tsvector('portuguese',${column}) @@ websearch_to_tsquery('portuguese',${param(value)})`,
        );
      else throw new Error('Unsupported fixture filter ' + op);
    }
    const select = url.searchParams.get('select') || '*';
    const selection = select === '*' ? '*' : select.split(',').map(identifier).join(',');
    const order = url.searchParams.get('order');
    const ordering = order
      ? ' order by ' +
        order
          .split(',')
          .map((o) => {
            const [column, dir] = o.split('.');
            return identifier(column) + (dir === 'desc' ? ' desc' : ' asc');
          })
          .join(',')
      : '';
    const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0);
    const limit = Math.min(1000, Number(url.searchParams.get('limit')) || 1000);
    const result = await db.as(
      role,
      actor,
      `select ${selection} from public.${resource}${where.length ? ' where ' + where.join(' and ') : ''}${ordering} limit ${limit} offset ${offset}`,
      values,
    );
    if (String(req.headers.accept).includes('vnd.pgrst.object')) {
      if (result.rows.length !== 1) {
        json(
          res,
          {
            code: 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: result.rows.length + ' rows',
          },
          406,
        );
        return;
      }
      json(res, result.rows[0]);
    } else json(res, result.rows);
  } catch (error) {
    const e = error as { message: string; code?: string };
    json(res, { message: e.message, code: e.code || 'P0001' }, 400);
  }
});
await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
const app = spawn(
  process.execPath,
  ['node_modules/next/dist/bin/next', 'start', '--port', '3100'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
      NEXT_PUBLIC_SUPABASE_URL: `http://localhost:${port}`,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
      GOOGLE_OAUTH_ENABLED: 'true',
      SUPABASE_SERVICE_ROLE_KEY: serviceKey,
      GOOGLE_PLACES_API_KEY: 'test-google-key',
      NODE_OPTIONS: `--import ${resolve('tests/e2e/google-preload.mjs')}`,
    },
  },
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  app.kill('SIGTERM');
  await new Promise<void>((r) => server.close(() => r()));
  await db.stop();
  process.exit(0);
}
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
app.on('exit', () => void stop());
