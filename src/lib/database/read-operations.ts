import 'server-only';
import { rows, type Executor, type SqlValue, type SqlRow } from './pool';
import type { Identity } from './client';
import type { LocalRequest, Metrics } from '@/lib/types';
export type Args = Record<string, unknown>;
export const int = (value: unknown, max = 100000) => Math.max(0, Math.min(max, Number(value) || 0));
export const text = (value: unknown) => (typeof value === 'string' ? value : '');
export async function readOperation(
  db: Executor,
  name: string,
  p: Args,
  actor: Identity | null,
): Promise<{ handled: boolean; value?: unknown }> {
  const id = actor?.id || null;
  const admin = actor?.admin || false;
  // Check again in the data statement: an account may be blocked, lose its profile or be
  // demoted after executeOperation's preflight. No cross-request permission cache is used.
  const access = `EXISTS(SELECT 1 FROM accounts access_account JOIN profiles access_profile ON access_profile.id=access_account.id WHERE access_account.id=? AND access_account.blocked=FALSE AND (?=FALSE OR access_account.is_admin=TRUE))`;
  const accessValues = [id, admin];
  let value: unknown;
  switch (name) {
    case 'health_check': {
      const [row] = await rows<{ ready: boolean }>(
        db,
        'SELECT EXISTS(SELECT 1 FROM cities) AS ready',
      );
      value = row.ready;
      break;
    }
    case 'account_state':
      value = {
        admin,
        onboarded: Boolean((await rows(db, 'SELECT id FROM profiles WHERE id=?', [id])).length),
      };
      break;
    case 'request_editable': {
      const [row] = await rows<{ editable: number }>(
        db,
        `SELECT EXISTS(SELECT 1 FROM requests r WHERE r.id=? AND r.requester_id=? AND r.status='OPEN' AND r.hidden_at IS NULL AND NOT EXISTS(SELECT 1 FROM indications i WHERE i.request_id=r.id)) AS editable WHERE ${access}`,
        [text(p.p_request_id), id, ...accessValues],
      );
      if (!row) throw new Error('AUTH_REQUIRED');
      value = Boolean(row.editable);
      break;
    }
    case 'member_summary': {
      const [row] = await rows(
        db,
        `SELECT (SELECT COUNT(*) FROM notifications n JOIN requests r ON r.id=n.request_id WHERE n.user_id=? AND n.read_at IS NULL AND r.hidden_at IS NULL) AS unread,
      (SELECT COUNT(*) FROM requests WHERE requester_id=? AND hidden_at IS NULL AND (status='REVEALED' OR (status='OPEN' AND indication_count>0))) AS pending,
      (SELECT COUNT(*) FROM request_interests i JOIN requests r ON r.id=i.request_id WHERE i.user_id=? AND i.saved=TRUE AND r.hidden_at IS NULL) AS saved WHERE ${access}`,
        [id, id, id, ...accessValues],
      );
      if (!row) throw new Error('AUTH_REQUIRED');
      value = row;
      break;
    }
    case 'profile_stats': {
      const [row] = await rows(
        db,
        `SELECT (SELECT COALESCE(SUM(points),0) FROM reward_events WHERE user_id=p.id) AS points,
      (SELECT COUNT(*) FROM reward_events WHERE user_id=p.id) AS confirmations,
      (SELECT COUNT(*) FROM requests WHERE requester_id=p.id AND hidden_at IS NULL) AS requests,
      (SELECT COUNT(*) FROM indications i JOIN requests r ON r.id=i.request_id WHERE i.user_id=p.id AND i.hidden_at IS NULL AND r.hidden_at IS NULL) AS indications
      FROM profiles p JOIN accounts a ON a.id=p.id WHERE p.username=? AND a.blocked=FALSE`,
        [text(p.p_username)],
      );
      value = row || { points: 0, confirmations: 0, requests: 0, indications: 0 };
      break;
    }
    case 'city_ranking':
      value = await rows(
        db,
        `SELECT ROW_NUMBER() OVER(ORDER BY SUM(e.points) DESC,COUNT(*) DESC,MIN(e.created_at),p.id) AS position,
      p.username,p.display_name,SUM(e.points) AS points,COUNT(*) AS confirmations FROM reward_events e JOIN profiles p ON p.id=e.user_id JOIN accounts a ON a.id=p.id
      WHERE e.city_id=? AND a.blocked=FALSE GROUP BY p.id,p.username,p.display_name ORDER BY position LIMIT 30 OFFSET ${int(p.p_offset)}`,
        [Number(p.p_city_id)],
      );
      break;
    case 'search_requests':
    case 'search_unanswered_requests': {
      const unanswered = name === 'search_unanswered_requests';
      const query = text(p.p_query).trim().slice(0, 300);
      const status = unanswered ? 'OPEN' : text(p.p_status) || 'OPEN';
      const conditions = ['r.city_id=?', 'r.status=?', access];
      const values: SqlValue[] = [Number(p.p_city_id), status, ...accessValues];
      if (unanswered || !admin) conditions.push('r.hidden_at IS NULL');
      if (unanswered) conditions.push('r.indication_count=0');
      // Token matching uses the UTF-8 accent-insensitive collation; short words remain searchable.
      for (const word of query.replace(/["()]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 20)) {
        conditions.push('r.description LIKE ?');
        values.push('%' + word.replace(/[\\%_]/g, '\\$&') + '%');
      }
      value = await rows<LocalRequest>(
        db,
        `SELECT r.* FROM requests r WHERE ${conditions.join(' AND ')} ORDER BY r.created_at ${unanswered ? 'ASC' : 'DESC'},r.id LIMIT 21 OFFSET ${int(p.p_offset, 20000)}`,
        values,
      );
      break;
    }
    case 'indication_groups': {
      const [request] = await rows<{
        requester_id: string;
        status: string;
        hidden_at: string | null;
      }>(db, 'SELECT requester_id,status,hidden_at FROM requests WHERE id=?', [
        text(p.p_request_id),
      ]);
      if (
        !request ||
        (!admin && (request.hidden_at || request.requester_id !== id || request.status === 'OPEN'))
      )
        throw new Error('NOT_ALLOWED');
      value = await rows(
        db,
        `SELECT place_id,COUNT(*) AS indications FROM indications WHERE request_id=? AND hidden_at IS NULL GROUP BY place_id ORDER BY indications DESC,MIN(created_at),place_id LIMIT 11 OFFSET ${int(p.p_offset)}`,
        [text(p.p_request_id)],
      );
      break;
    }
    case 'request_photo': {
      const [row] = await rows<{ jpeg: Buffer }>(
        db,
        `SELECT p.jpeg FROM request_photos p JOIN requests r ON r.id=p.request_id WHERE r.id=? AND (r.hidden_at IS NULL OR ?=TRUE) AND ${access}`,
        [text(p.p_request_id), admin, ...accessValues],
      );
      value = row?.jpeg?.toString('base64') || null;
      break;
    }
    case 'admin_accounts':
      if (!admin) throw new Error('NOT_ALLOWED');
      value = await rows(
        db,
        `SELECT a.id,p.username,p.display_name,a.blocked,a.created_at FROM accounts a LEFT JOIN profiles p ON p.id=a.id WHERE (?='' OR p.username LIKE ? OR p.display_name LIKE ?) ORDER BY a.created_at DESC LIMIT 30 OFFSET ${int(p.p_offset)}`,
        [
          text(p.p_search),
          `%${text(p.p_search).slice(0, 60)}%`,
          `%${text(p.p_search).slice(0, 60)}%`,
        ],
      );
      break;
    case 'admin_operations': {
      if (!admin) throw new Error('NOT_ALLOWED');
      const [row] = await rows(
        db,
        `SELECT COALESCE(SUM(status IN ('PENDING','PROCESSING')),0) AS pending_email,COALESCE(SUM(status='SENT'),0) AS sent_email,COALESCE(SUM(status='CANCELED' AND attempts>=5),0) AS failed_email FROM email_jobs`,
      );
      value = row;
      break;
    }
    case 'admin_metrics':
      if (!admin) throw new Error('NOT_ALLOWED');
      value = await metrics(db, p);
      break;
    default:
      return { handled: false };
  }
  return { handled: true, value };
}
function quantile(values: number[], q: number) {
  if (!values.length) return null;
  values.sort((a, b) => a - b);
  const pos = (values.length - 1) * q,
    base = Math.floor(pos);
  return (
    values[base] +
    (values[base + 1] === undefined ? 0 : (values[base + 1] - values[base]) * (pos - base))
  );
}
async function metrics(db: Executor, p: Args): Promise<Metrics> {
  const city = p.p_city_id ? Number(p.p_city_id) : null,
    since = p.p_since ? new Date(text(p.p_since)) : null,
    until = p.p_until ? new Date(text(p.p_until)) : null;
  if (
    (since && !Number.isFinite(since.getTime())) ||
    (until && !Number.isFinite(until.getTime())) ||
    (since && until && since >= until)
  )
    throw new Error('INVALID_INPUT');
  const values: SqlValue[] = [city, city, since, since, until, until];
  const eligible = `SELECT r.*,s.type AS resolution_type,TIMESTAMPDIFF(SECOND,r.created_at,s.created_at) AS resolution_seconds,(SELECT MIN(i.created_at) FROM indications i WHERE i.request_id=r.id) AS first_at FROM requests r LEFT JOIN request_resolutions s ON s.request_id=r.id WHERE r.hidden_at IS NULL AND r.status<>'CANCELED' AND (? IS NULL OR r.city_id=?) AND (? IS NULL OR r.created_at>=?) AND (? IS NULL OR r.created_at<?)`;
  const requests = await rows<SqlRow>(db, eligible, values);
  const counts = await rows<{ user_id: string; hits: number }>(
    db,
    `SELECT i.user_id,COUNT(*) AS hits FROM indications i JOIN (${eligible}) r ON r.id=i.request_id GROUP BY i.user_id`,
    values,
  );
  const [onboarded] = await rows<{ hits: number }>(
    db,
    `SELECT COUNT(DISTINCT l.actor_id) AS hits FROM audit_logs l JOIN profiles p ON p.id=l.actor_id WHERE l.event_type='ONBOARDING_COMPLETED' AND (? IS NULL OR p.home_city_id=?) AND (? IS NULL OR l.created_at>=?) AND (? IS NULL OR l.created_at<?)`,
    values,
  );
  const analytics = await rows<{ event: string; hits: number }>(
    db,
    'SELECT event,SUM(hits) AS hits FROM analytics WHERE (? IS NULL OR day>=DATE(?)) AND (? IS NULL OR day<DATE(?)) GROUP BY event',
    [since, since, until, until],
  );
  const search = await rows<{ kind: string; hits: number }>(
    db,
    'SELECT kind,COUNT(*) AS hits FROM search_events WHERE (? IS NULL OR city_id=?) AND (? IS NULL OR created_at>=?) AND (? IS NULL OR created_at<?) GROUP BY kind',
    values,
  );
  const first = requests
    .filter((r) => r.first_at)
    .map((r) => (Date.parse(String(r.first_at)) - Date.parse(String(r.created_at))) / 1000);
  const resolution = requests
    .filter((r) => r.resolution_type === 'INDICATED_PLACE')
    .map((r) => Number(r.resolution_seconds));
  const mean = (list: number[]) =>
    list.length ? list.reduce((a, b) => a + b, 0) / list.length : null;
  return {
    requests: requests.length,
    with_indications: first.length,
    resolved: resolution.length,
    other_place: requests.filter((r) => r.resolution_type === 'OTHER_PLACE').length,
    not_found: requests.filter((r) => r.resolution_type === 'NOT_FOUND').length,
    without_indications: requests.filter((r) => r.status === 'OPEN' && !r.first_at).length,
    awaiting_decision: requests.filter(
      (r) => r.status === 'REVEALED' || (r.status === 'OPEN' && Number(r.indication_count) > 0),
    ).length,
    contributors: counts.length,
    returning_contributors: counts.filter((r) => r.hits > 1).length,
    onboarded: onboarded.hits,
    avg_first_indication_seconds: mean(first),
    median_first_indication_seconds: quantile(first, 0.5),
    p90_first_indication_seconds: quantile(first, 0.9),
    avg_resolution_seconds: mean(resolution),
    median_resolution_seconds: quantile(resolution, 0.5),
    p90_resolution_seconds: quantile(resolution, 0.9),
    analytics: Object.fromEntries(analytics.map((r) => [r.event, Number(r.hits)])),
    search: Object.fromEntries(search.map((r) => [r.kind, r.hits])),
  };
}
