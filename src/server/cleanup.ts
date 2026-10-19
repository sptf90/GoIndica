import 'server-only';
import type { ResultSetHeader } from 'mysql2/promise';
import { pool } from '@/lib/database/pool';
export async function cleanupExpired() {
  const db = pool();
  const removed = async (sql: string) =>
    (await db.execute<ResultSetHeader>({ sql, timeout: 5000 }))[0].affectedRows;
  return {
    sessions: await removed('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)'),
    tokens: await removed('DELETE FROM auth_tokens WHERE expires_at<UTC_TIMESTAMP(3)'),
    rate_limits: await removed(
      'DELETE FROM rate_limits WHERE window_start<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 2 DAY)',
    ),
  };
}
