import 'server-only';
import type { Executor } from './pool';
import { rows } from './pool';
export async function rate(
  db: Executor,
  actor: string,
  bucket: string,
  maximum: number,
  seconds: number,
) {
  await db.execute(
    `INSERT INTO rate_limits(actor_id,bucket,window_start,hits) VALUES(?,?,UTC_TIMESTAMP(3),1)
    ON DUPLICATE KEY UPDATE hits=IF(window_start < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? SECOND),1,hits+1),
    window_start=IF(window_start < DATE_SUB(UTC_TIMESTAMP(3), INTERVAL ? SECOND),UTC_TIMESTAMP(3),window_start)`,
    [actor, bucket, seconds, seconds],
  );
  const [result] = await rows<{ hits: number }>(
    db,
    'SELECT hits FROM rate_limits WHERE actor_id=? AND bucket=?',
    [actor, bucket],
  );
  if (result.hits > maximum) throw new Error('RATE_LIMITED');
}
