import 'server-only';
import mysql, { type Pool, type PoolConnection, type RowDataPacket } from 'mysql2/promise';
import { requiredEnv } from '@/lib/env';
export type SqlValue = string | number | boolean | null | Buffer | Date;
export type SqlRow = Record<string, unknown>;
export type Executor = Pick<Pool, 'execute' | 'query'>;
const globalDatabase = globalThis as typeof globalThis & { goindicaPool?: Pool };
export function pool() {
  if (!globalDatabase.goindicaPool) {
    globalDatabase.goindicaPool = mysql.createPool({
      host: requiredEnv('MYSQL_HOST'),
      port: Number(process.env.MYSQL_PORT || 3306),
      user: requiredEnv('MYSQL_USER'),
      password: requiredEnv('MYSQL_PASSWORD'),
      database: requiredEnv('MYSQL_DATABASE'),
      connectionLimit: Math.max(1, Math.min(10, Number(process.env.MYSQL_POOL_SIZE || 5))),
      waitForConnections: true,
      queueLimit: 100,
      connectTimeout: 5000,
      charset: 'utf8mb4',
      timezone: 'Z',
      decimalNumbers: true,
      supportBigNumbers: true,
      ...(process.env.MYSQL_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
    });
  }
  return globalDatabase.goindicaPool;
}
const booleanFields = new Set([
  'blocked',
  'is_admin',
  'admin',
  'onboarded',
  'saved',
  'following',
  'wanted',
  'has_photo',
  'email_reminders',
  'eligible',
  'ready',
]);
export function normalizeRow(row: SqlRow): SqlRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      value instanceof Date
        ? value.toISOString()
        : booleanFields.has(key) && value !== null
          ? Boolean(value)
          : key === 'metadata' && typeof value === 'string'
            ? JSON.parse(value)
            : value,
    ]),
  );
}
export async function rows<T = SqlRow>(
  db: Executor,
  sql: string,
  values: SqlValue[] = [],
): Promise<T[]> {
  const [result] = await db.execute<RowDataPacket[]>({ sql, timeout: 5000 }, values);
  return result.map((row) => normalizeRow(row)) as T[];
}
export async function transaction<T>(
  action: (connection: PoolConnection) => Promise<T>,
  isolation: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const connection = await pool().getConnection();
    try {
      await connection.query(
        "SET time_zone = '+00:00', @goindica_anonymizing=0, @goindica_importing=0",
      );
      await connection.query('SET TRANSACTION ISOLATION LEVEL ' + isolation);
      await connection.beginTransaction();
      const result = await action(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
      if (attempt === 2 || !['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(code))
        throw error;
    } finally {
      try {
        await connection.query('SET @goindica_anonymizing=0, @goindica_importing=0');
      } catch {
        connection.destroy();
      } finally {
        connection.release();
      }
    }
    // Only rolled-back SQL transactions are retried; SMTP and other effects run outside this helper.
    await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1)));
  }
  throw new Error('SERVICE_UNAVAILABLE');
}
export function databaseError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const message = error instanceof Error ? error.message : 'SERVICE_UNAVAILABLE';
  const domain = message.match(
    /\b(?:AUTH_REQUIRED|ACCOUNT_BLOCKED|ONBOARDING_REQUIRED|NOT_ALLOWED|SELF_INDICATION|ALREADY_INDICATED|INVALID_CITY|RESPONSES_LOCKED|REQUEST_CLOSED|REVEAL_REQUIRED|NO_INDICATIONS|INVALID_PLACE|EDIT_LOCKED|RATE_LIMITED|INVALID_INPUT|CITY_LIMIT|TOPIC_LIMIT|ADMIN_ACCOUNT|CLOSURE_REQUIRED|INVALID_PHOTO|PHOTO_TOO_LARGE|IMMUTABLE_LEDGER)\b/,
  );
  return {
    message: domain?.[0] || 'SERVICE_UNAVAILABLE',
    code: code === 'ER_DUP_ENTRY' ? '23505' : code,
  };
}
