import 'server-only';
import { LocalAuth } from '@/lib/auth/service';
import { pool, rows, databaseError, type SqlValue } from './pool';
import { executeOperation } from './operations';
import type { Database } from './types';
type Tables = Database['public']['Tables'];
type TableName = keyof Tables;
type OperationName = keyof Database['public']['Functions'];
export type Identity = { id: string; admin: boolean };
type Result<T> = { data: T | null; error: { message: string; code?: string } | null };
type Split<S extends string> = S extends `${infer A},${infer B}` ? A | Split<B> : S;
type Selected<T, S extends string> = S extends '*' ? T : Pick<T, Extract<Split<S>, keyof T>>;
const tableNames: TableName[] = [
  'audit_logs',
  'cities',
  'followed_cities',
  'indications',
  'notifications',
  'places',
  'profiles',
  'reports',
  'request_interests',
  'request_reconfirmations',
  'request_resolutions',
  'requests',
  'reward_events',
  'support_requests',
  'topic_alerts',
  'user_preferences',
];
function identifier(value: string) {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) throw new Error('INVALID_INPUT');
  return '`' + value + '`';
}
export class DatabaseClient {
  readonly auth = new LocalAuth();
  private identityPromise: Promise<Identity | null> | undefined;
  constructor(
    readonly privileged = false,
    private suppliedIdentity?: Identity,
  ) {}
  async identity(): Promise<Identity | null> {
    if (this.suppliedIdentity) return this.suppliedIdentity;
    this.identityPromise ??= (async () => {
      const {
        data: { user },
        error,
      } = await this.auth.getUser();
      if (error) throw error;
      if (!user || user.sessionPurpose !== 'access') return null;
      const [account] = await rows<{ blocked: boolean; is_admin: boolean }>(
        pool(),
        'SELECT blocked,is_admin FROM accounts WHERE id=?',
        [user.id],
      );
      if (!account || account.blocked) throw new Error('ACCOUNT_BLOCKED');
      return { id: user.id, admin: account.is_admin };
    })();
    return this.identityPromise;
  }
  from<N extends TableName>(table: N) {
    if (!tableNames.includes(table)) throw new Error('NOT_ALLOWED');
    return new Query<Tables[N]['Row']>(this, table);
  }
  call<N extends OperationName>(
    name: N,
    args?: Database['public']['Functions'][N]['Args'],
  ): Promise<Result<Database['public']['Functions'][N]['Returns']>> {
    return (async () => {
      try {
        return {
          data: (await executeOperation(
            this,
            name,
            args || {},
          )) as Database['public']['Functions'][N]['Returns'],
          error: null,
        };
      } catch (error) {
        return { data: null, error: databaseError(error) };
      }
    })();
  }
}
class Query<T> implements PromiseLike<Result<T[]>> {
  private columns = '*';
  private filters: string[] = [];
  private values: SqlValue[] = [];
  private orders: string[] = [];
  private maximum = 1000;
  private offset = 0;
  constructor(
    private client: DatabaseClient,
    private table: TableName,
  ) {}
  select<S extends string>(columns: S): Query<Selected<T, S>> {
    this.columns = columns;
    return this as unknown as Query<Selected<T, S>>;
  }
  private filter(column: string, operator: string, value: SqlValue) {
    this.filters.push(`t.${identifier(column)} ${operator} ?`);
    this.values.push(value);
    return this;
  }
  eq(column: string, value: SqlValue) {
    return this.filter(column, '=', value);
  }
  neq(column: string, value: SqlValue) {
    return this.filter(column, '<>', value);
  }
  gt(column: string, value: SqlValue) {
    return this.filter(column, '>', value);
  }
  gte(column: string, value: SqlValue) {
    return this.filter(column, '>=', value);
  }
  lt(column: string, value: SqlValue) {
    return this.filter(column, '<', value);
  }
  lte(column: string, value: SqlValue) {
    return this.filter(column, '<=', value);
  }
  ilike(column: string, value: string) {
    return this.filter(column, 'LIKE', value);
  }
  is(column: string, value: null | boolean) {
    if (value === null) this.filters.push(`t.${identifier(column)} IS NULL`);
    else this.eq(column, value);
    return this;
  }
  in(column: string, values: SqlValue[]) {
    this.filters.push(
      values.length ? `t.${identifier(column)} IN (${values.map(() => '?').join(',')})` : 'FALSE',
    );
    this.values.push(...values);
    return this;
  }
  or(expression: string) {
    // The only compound filter exposed by application pages. No raw SQL is accepted.
    if (expression !== 'status.eq.REVEALED,and(status.eq.OPEN,indication_count.gt.0)')
      throw new Error('INVALID_INPUT');
    this.filters.push("(t.status='REVEALED' OR (t.status='OPEN' AND t.indication_count>0))");
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push(`t.${identifier(column)} ${options?.ascending === false ? 'DESC' : 'ASC'}`);
    return this;
  }
  limit(count: number) {
    this.maximum = Math.max(0, Math.min(1000, Math.trunc(count)));
    return this;
  }
  range(from: number, to: number) {
    this.offset = Math.max(0, Math.min(100000, Math.trunc(from)));
    return this.limit(to - from + 1);
  }
  async single(): Promise<Result<T>> {
    const result = await this.run(2);
    if (result.error) return { data: null, error: result.error };
    return result.data?.length === 1
      ? { data: result.data[0], error: null }
      : { data: null, error: { message: 'NOT_ALLOWED', code: 'ROW_NOT_FOUND' } };
  }
  async maybeSingle(): Promise<Result<T>> {
    const result = await this.run(2);
    if (result.error) return { data: null, error: result.error };
    if ((result.data?.length || 0) > 1) return { data: null, error: { message: 'INVALID_INPUT' } };
    return { data: result.data?.[0] || null, error: null };
  }
  then<TResult1 = Result<T[]>, TResult2 = never>(
    fulfilled?: ((value: Result<T[]>) => TResult1 | PromiseLike<TResult1>) | null,
    rejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.run().then(fulfilled, rejected);
  }
  private async policy(): Promise<{ sql: string; values: SqlValue[] }> {
    if (this.client.privileged) return { sql: 'TRUE', values: [] };
    if (this.table === 'cities') return { sql: 'TRUE', values: [] };
    const actor = await this.client.identity();
    if (this.table === 'profiles')
      return actor?.admin
        ? {
            sql: 'EXISTS(SELECT 1 FROM accounts a WHERE a.id=? AND a.blocked=FALSE AND a.is_admin=TRUE)',
            values: [actor.id],
          }
        : {
            sql: '(EXISTS(SELECT 1 FROM accounts a WHERE a.id=t.id AND a.blocked=FALSE) OR t.id=?)',
            values: [actor?.id || null],
          };
    if (!actor) throw new Error('AUTH_REQUIRED');
    // Recheck account activity in SQL, so a cached request context cannot expose data after blocking.
    const active = `EXISTS(SELECT 1 FROM accounts a WHERE a.id=? AND a.blocked=FALSE${actor.admin ? ' AND a.is_admin=TRUE' : ''})`;
    const id = actor.id;
    let sql = 'FALSE';
    let values: SqlValue[] = [];
    if (
      actor.admin &&
      ![
        'user_preferences',
        'followed_cities',
        'request_interests',
        'notifications',
        'topic_alerts',
        'request_reconfirmations',
      ].includes(this.table)
    )
      sql = 'TRUE';
    else
      switch (this.table) {
        case 'requests':
          sql = 't.hidden_at IS NULL';
          break;
        case 'indications':
          sql = `t.hidden_at IS NULL AND EXISTS(SELECT 1 FROM requests r WHERE r.id=t.request_id AND r.hidden_at IS NULL AND (t.user_id=? OR (r.requester_id=? AND r.status<>'OPEN')))`;
          values = [id, id];
          break;
        case 'places':
          sql = `t.hidden_at IS NULL AND (EXISTS(SELECT 1 FROM indications i JOIN requests r ON r.id=i.request_id WHERE i.place_id=t.id AND i.hidden_at IS NULL AND r.hidden_at IS NULL AND (i.user_id=? OR (r.requester_id=? AND r.status<>'OPEN'))) OR EXISTS(SELECT 1 FROM request_resolutions s JOIN requests r ON r.id=s.request_id WHERE s.place_id=t.id AND r.status='RESOLVED' AND r.hidden_at IS NULL))`;
          values = [id, id];
          break;
        case 'request_resolutions':
          sql = 'EXISTS(SELECT 1 FROM requests r WHERE r.id=t.request_id AND r.hidden_at IS NULL)';
          break;
        case 'reports':
          sql = 't.reporter_id=?';
          values = [id];
          break;
        case 'support_requests':
        case 'reward_events':
        case 'user_preferences':
        case 'followed_cities':
        case 'topic_alerts':
        case 'request_reconfirmations':
          sql = 't.user_id=?';
          values = [id];
          break;
        case 'request_interests':
        case 'notifications':
          sql =
            't.user_id=? AND EXISTS(SELECT 1 FROM requests r WHERE r.id=t.request_id AND r.hidden_at IS NULL)';
          values = [id];
          break;
      }
    return { sql: `${active} AND (${sql})`, values: [id, ...values] };
  }
  private async run(limit = this.maximum): Promise<Result<T[]>> {
    try {
      const policy = await this.policy();
      const columns =
        this.columns === '*'
          ? 't.*'
          : this.columns
              .split(',')
              .map((c) => 't.' + identifier(c.trim()))
              .join(',');
      const sql = `SELECT ${columns} FROM ${identifier(this.table)} t WHERE ${policy.sql}${this.filters.length ? ' AND ' + this.filters.join(' AND ') : ''}${this.orders.length ? ' ORDER BY ' + this.orders.join(',') : ''} LIMIT ${limit} OFFSET ${this.offset}`;
      return { data: await rows<T>(pool(), sql, [...policy.values, ...this.values]), error: null };
    } catch (error) {
      return { data: null, error: databaseError(error) };
    }
  }
}
