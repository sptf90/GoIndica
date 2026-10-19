import 'server-only';
import { randomUUID } from 'node:crypto';
import type { PoolConnection } from 'mysql2/promise';
import { pool, rows, transaction } from './pool';
import { rate } from './rate';
import { readOperation, text, int, type Args } from './read-operations';
import type { DatabaseClient, Identity } from './client';
import type { LocalRequest } from '@/lib/types';
import { normalizeCity } from '@/lib/validation/schemas';
const serviceOnly = new Set([
  'health_check',
  'record_analytics',
  'prepare_reminders',
  'claim_email_jobs',
  'email_job_eligible',
  'finish_email_job',
]);
const publicCalls = new Set(['city_ranking', 'profile_stats']);
const withoutProfile = new Set(['account_state', 'save_profile', 'log_login']);
// These reads recheck account/profile access inside their data SELECT. They need no write transaction.
const simpleReads = new Set([
  'member_summary',
  'search_requests',
  'search_unanswered_requests',
  'request_editable',
  'request_photo',
]);
export async function executeOperation(
  client: DatabaseClient,
  name: string,
  p: object,
): Promise<unknown> {
  if (serviceOnly.has(name) && !client.privileged) throw new Error('NOT_ALLOWED');
  if (client.privileged && !serviceOnly.has(name)) throw new Error('NOT_ALLOWED');
  const identity = client.privileged || publicCalls.has(name) ? null : await client.identity();
  // Parallel operations must not overwrite each other's freshly checked permissions.
  const actor = identity ? { ...identity } : null;
  if (!client.privileged && !publicCalls.has(name) && !actor) throw new Error('AUTH_REQUIRED');
  if (publicCalls.has(name) || name === 'health_check')
    return (await readOperation(pool(), name, p as Args, actor)).value;
  if (actor && (simpleReads.has(name) || name === 'account_state')) {
    const [account] = await rows<{
      blocked: boolean;
      is_admin: boolean;
      onboarded: boolean;
    }>(
      pool(),
      'SELECT a.blocked,a.is_admin,EXISTS(SELECT 1 FROM profiles p WHERE p.id=a.id) AS onboarded FROM accounts a WHERE a.id=?',
      [actor.id],
    );
    if (!account || account.blocked) throw new Error('ACCOUNT_BLOCKED');
    actor.admin = account.is_admin;
    if (name === 'account_state') return { admin: account.is_admin, onboarded: account.onboarded };
    if (!account.onboarded) throw new Error('ONBOARDING_REQUIRED');
    return (await readOperation(pool(), name, p as Args, actor)).value;
  }
  return transaction(
    async (db) => {
      if (actor) {
        const [account] = await rows<{
          blocked: boolean;
          is_admin: boolean;
          onboarded: boolean;
        }>(
          db,
          'SELECT a.blocked,a.is_admin,EXISTS(SELECT 1 FROM profiles p WHERE p.id=a.id) AS onboarded FROM accounts a WHERE a.id=? LOCK IN SHARE MODE',
          [actor.id],
        );
        if (!account || account.blocked) throw new Error('ACCOUNT_BLOCKED');
        actor.admin = account.is_admin;
        if (!publicCalls.has(name) && !withoutProfile.has(name) && !account.onboarded)
          throw new Error('ONBOARDING_REQUIRED');
      }
      const args = p as Args;
      const result = await readOperation(db, name, args, actor);
      if (result.handled) return result.value;
      return mutate(db, name, args, actor);
    },
    ['export_account', 'admin_metrics'].includes(name) ? 'REPEATABLE READ' : 'READ COMMITTED',
  );
}
export async function log(
  db: PoolConnection,
  actor: string | null,
  event: string,
  entity: string,
  id: string | null,
  metadata: object = {},
) {
  await db.execute(
    'INSERT INTO audit_logs(id,actor_id,event_type,entity_type,entity_id,metadata) VALUES(?,?,?,?,?,?)',
    [randomUUID(), actor, event, entity, id, JSON.stringify(metadata)],
  );
}
async function notify(
  db: PoolConnection,
  user: string,
  request: string,
  kind: string,
  key: string,
) {
  await db.execute(
    `INSERT IGNORE INTO notifications(id,user_id,request_id,kind,dedupe_key) SELECT ?,?,?,?,? FROM accounts WHERE id=? AND blocked=FALSE`,
    [randomUUID(), user, request, kind, key, user],
  );
}
async function requestLock(
  db: PoolConnection,
  p: Args,
  actor: Identity | null,
  owner = false,
): Promise<LocalRequest> {
  const [r] = await rows<LocalRequest>(db, 'SELECT * FROM requests WHERE id=? FOR UPDATE', [
    text(p.p_request_id),
  ]);
  if (!r || (r.hidden_at && !actor?.admin) || (owner && r.requester_id !== actor?.id))
    throw new Error('NOT_ALLOWED');
  return r;
}
async function countSync(db: PoolConnection, id: string) {
  await db.execute(
    `UPDATE requests SET wanting_count=(SELECT COUNT(*) FROM request_interests WHERE request_id=? AND wanted=TRUE),reconfirmation_count=(SELECT COUNT(*) FROM request_reconfirmations WHERE request_id=?),last_reconfirmed_at=(SELECT MAX(confirmed_at) FROM request_reconfirmations WHERE request_id=?) WHERE id=?`,
    [id, id, id, id],
  );
}
async function photo(db: PoolConnection, id: string, value: unknown, remove: unknown = false) {
  if (value) {
    const jpeg = Buffer.from(text(value), 'base64');
    if (jpeg.length > 524288) throw new Error('PHOTO_TOO_LARGE');
    if (jpeg.length < 4 || jpeg.subarray(0, 3).toString('hex') !== 'ffd8ff')
      throw new Error('INVALID_PHOTO');
    await db.execute(
      'INSERT INTO request_photos(request_id,jpeg) VALUES(?,?) ON DUPLICATE KEY UPDATE jpeg=VALUES(jpeg),updated_at=UTC_TIMESTAMP(3)',
      [id, jpeg],
    );
    await db.execute(
      'UPDATE requests SET has_photo=TRUE,photo_updated_at=UTC_TIMESTAMP(3) WHERE id=?',
      [id],
    );
  } else if (remove) {
    await db.execute('DELETE FROM request_photos WHERE request_id=?', [id]);
    await db.execute('UPDATE requests SET has_photo=FALSE,photo_updated_at=NULL WHERE id=?', [id]);
  }
}
async function topics(db: PoolConnection, r: LocalRequest) {
  const alerts = await rows<{ user_id: string; normalized_term: string }>(
    db,
    'SELECT user_id,normalized_term FROM topic_alerts WHERE city_id=? AND user_id<>?',
    [r.city_id, r.requester_id],
  );
  const description = normalizeCity(r.description);
  for (const alert of alerts)
    if (alert.normalized_term.split(' ').every((w) => description.includes(w)))
      await notify(db, alert.user_id, r.id, 'TOPIC_MATCH', 'topic:' + r.id + ':' + alert.user_id);
}
async function mutate(
  db: PoolConnection,
  name: string,
  p: Args,
  actor: Identity | null,
): Promise<unknown> {
  const id = actor?.id || '';
  const admin = () => {
    if (!actor?.admin) throw new Error('NOT_ALLOWED');
  };
  switch (name) {
    case 'save_profile': {
      const username = text(p.p_username).trim().toLowerCase(),
        display = text(p.p_display_name).trim();
      if (!/^[a-z][a-z0-9_]{2,23}$/.test(username) || display.length < 2 || display.length > 60)
        throw new Error('INVALID_INPUT');
      await rate(db, id, 'profile', 20, 3600);
      const existing = (await rows(db, 'SELECT id FROM profiles WHERE id=?', [id])).length;
      if (existing)
        await db.execute(
          'UPDATE profiles SET username=?,display_name=?,home_city_id=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
          [username, display, Number(p.p_city_id), id],
        );
      else
        await db.execute(
          'INSERT INTO profiles(id,username,display_name,home_city_id) VALUES(?,?,?,?)',
          [id, username, display, Number(p.p_city_id)],
        );
      await log(db, id, existing ? 'PROFILE_UPDATED' : 'ONBOARDING_COMPLETED', 'PROFILE', id);
      return;
    }
    case 'log_login':
      await log(db, id, 'LOGIN', 'ACCOUNT', id);
      return;
    case 'consume_api_limit':
      if (
        !['places_search', 'places_details', 'places_view', 'places_create'].includes(
          text(p.p_bucket),
        )
      )
        throw new Error('INVALID_INPUT');
      await rate(db, id, text(p.p_bucket), 30, 60);
      return;
    case 'consume_share_card_limit':
      await rate(db, id, 'share_cards', 10, 60);
      return;
    case 'create_request_with_photo': {
      const description = text(p.p_description).trim(),
        neighborhood = text(p.p_neighborhood).trim();
      if (description.length < 3 || description.length > 300 || neighborhood.length > 100)
        throw new Error('INVALID_INPUT');
      await rate(db, id, 'requests', 10, 3600);
      const requestId = randomUUID();
      await db.execute(
        'INSERT INTO requests(id,requester_id,description,city_id,neighborhood) VALUES(?,?,?,?,?)',
        [requestId, id, description, Number(p.p_city_id), neighborhood || null],
      );
      await photo(db, requestId, p.p_photo);
      await log(db, id, 'REQUEST_CREATED', 'REQUEST', requestId);
      await topics(
        db,
        (await rows<LocalRequest>(db, 'SELECT * FROM requests WHERE id=?', [requestId]))[0],
      );
      return requestId;
    }
    case 'edit_request_with_photo': {
      const r = await requestLock(db, p, actor, true);
      if (
        r.status !== 'OPEN' ||
        (await rows(db, 'SELECT id FROM indications WHERE request_id=? LIMIT 1', [r.id])).length
      )
        throw new Error('EDIT_LOCKED');
      const description = text(p.p_description).trim(),
        neighborhood = text(p.p_neighborhood).trim();
      if (description.length < 3 || description.length > 300 || neighborhood.length > 100)
        throw new Error('INVALID_INPUT');
      await rate(db, id, 'edits', 20, 3600);
      await db.execute(
        'UPDATE requests SET description=?,city_id=?,neighborhood=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
        [description, Number(p.p_city_id), neighborhood || null, r.id],
      );
      await photo(db, r.id, p.p_photo, p.p_remove_photo);
      await log(db, id, 'REQUEST_EDITED', 'REQUEST', r.id);
      await topics(db, { ...r, description, city_id: Number(p.p_city_id) });
      return;
    }
    case 'submit_verified_indication': {
      if (p.p_actor !== id) throw new Error('NOT_ALLOWED');
      const r = await requestLock(db, p, actor);
      if (r.requester_id === id) throw new Error('SELF_INDICATION');
      if (r.status !== 'OPEN') throw new Error('RESPONSES_LOCKED');
      const [place] = await rows<{ id: string; city_id: number }>(
        db,
        'SELECT id,city_id FROM places WHERE id=? AND hidden_at IS NULL',
        [text(p.p_place_id)],
      );
      if (!place) throw new Error('INVALID_PLACE');
      if (place.city_id !== r.city_id || Number(p.p_verified_city_id) !== r.city_id)
        throw new Error('INVALID_CITY');
      if (
        (await rows(db, 'SELECT id FROM indications WHERE request_id=? AND user_id=?', [r.id, id]))
          .length
      )
        throw new Error('ALREADY_INDICATED');
      const comment = text(p.p_comment).trim();
      if (comment.length > 300) throw new Error('INVALID_INPUT');
      await rate(db, id, 'indications', 30, 3600);
      const indicationId = randomUUID();
      await db.execute(
        'INSERT INTO indications(id,request_id,user_id,place_id,comment) VALUES(?,?,?,?,?)',
        [indicationId, r.id, id, place.id, comment || null],
      );
      await db.execute(
        'UPDATE requests SET indication_count=indication_count+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?',
        [r.id],
      );
      await log(db, id, 'INDICATION_CREATED', 'INDICATION', indicationId);
      const [signals] = await rows<{ indications_last_hour: number; recent_account: number }>(
        db,
        'SELECT (SELECT COUNT(*) FROM indications WHERE user_id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 HOUR)) AS indications_last_hour,EXISTS(SELECT 1 FROM accounts WHERE id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)) AS recent_account',
        [id, id],
      );
      await log(db, id, 'INDICATION_AUDIT_SIGNALS', 'INDICATION', indicationId, {
        indications_last_hour: signals.indications_last_hour,
        recent_account: Boolean(signals.recent_account),
      });
      if (r.indication_count === 0)
        await log(db, id, 'FIRST_INDICATION', 'REQUEST', r.id, {
          seconds: (Date.now() - Date.parse(r.created_at)) / 1000,
        });
      const recipients = await rows<{ user_id: string }>(
        db,
        'SELECT user_id FROM request_interests WHERE request_id=? AND following=TRUE AND user_id<>?',
        [r.id, id],
      );
      for (const recipient of new Set([r.requester_id, ...recipients.map((v) => v.user_id)]))
        await notify(
          db,
          recipient,
          r.id,
          'INDICATION_RECEIVED',
          'indication:' + indicationId + ':' + recipient,
        );
      return indicationId;
    }
    case 'reveal_responses': {
      const r = await requestLock(db, p, actor, true);
      if (r.status === 'REVEALED') return;
      if (r.status !== 'OPEN') throw new Error('REQUEST_CLOSED');
      if (!r.indication_count) throw new Error('NO_INDICATIONS');
      await db.execute(
        "UPDATE requests SET status='REVEALED',responses_revealed_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?",
        [r.id],
      );
      await log(db, id, 'RESPONSES_REVEALED', 'REQUEST', r.id);
      return;
    }
    case 'resolve_request': {
      const r = await requestLock(db, p, actor, true),
        kind = text(p.p_type),
        placeId = p.p_place_id ? text(p.p_place_id) : null;
      if (!['INDICATED_PLACE', 'OTHER_PLACE', 'NOT_FOUND'].includes(kind))
        throw new Error('INVALID_INPUT');
      const [existing] = await rows<{ id: string; type: string; place_id: string | null }>(
        db,
        'SELECT id,type,place_id FROM request_resolutions WHERE request_id=?',
        [r.id],
      );
      if (existing) {
        if (existing.type === kind && existing.place_id === placeId) return existing.id;
        throw new Error('REQUEST_CLOSED');
      }
      if (r.status !== 'REVEALED') throw new Error('REVEAL_REQUIRED');
      if (kind === 'INDICATED_PLACE') {
        if (
          !placeId ||
          !(
            await rows(
              db,
              'SELECT id FROM indications WHERE request_id=? AND place_id=? AND hidden_at IS NULL LIMIT 1',
              [r.id, placeId],
            )
          ).length
        )
          throw new Error('INVALID_PLACE');
      } else if (placeId) throw new Error('INVALID_PLACE');
      const resolutionId = randomUUID();
      await db.execute(
        'INSERT INTO request_resolutions(id,request_id,type,place_id,resolved_by) VALUES(?,?,?,?,?)',
        [resolutionId, r.id, kind, placeId, id],
      );
      await db.execute('UPDATE requests SET status=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [
        kind === 'NOT_FOUND' ? 'CLOSED_NO_RESULT' : 'RESOLVED',
        r.id,
      ]);
      const recipients = await rows<{ user_id: string }>(
        db,
        'SELECT user_id FROM indications WHERE request_id=? AND hidden_at IS NULL UNION SELECT user_id FROM request_interests WHERE request_id=? AND following=TRUE AND user_id<>?',
        [r.id, r.id, id],
      );
      for (const recipient of recipients)
        await notify(
          db,
          recipient.user_id,
          r.id,
          'RESULT_RECORDED',
          'result:' + resolutionId + ':' + recipient.user_id,
        );
      if (kind === 'INDICATED_PLACE') {
        const eligible = await rows<{ id: string; user_id: string }>(
          db,
          'SELECT i.id,i.user_id FROM indications i JOIN accounts a ON a.id=i.user_id WHERE i.request_id=? AND i.place_id=? AND i.hidden_at IS NULL AND a.blocked=FALSE',
          [r.id, placeId],
        );
        for (const indication of eligible) {
          const rewardId = randomUUID();
          await db.execute(
            'INSERT INTO reward_events(id,user_id,request_id,indication_id,city_id) VALUES(?,?,?,?,?)',
            [rewardId, indication.user_id, r.id, indication.id, r.city_id],
          );
          await log(db, indication.user_id, 'SUCCESSFUL_INDICATION_REWARD', 'REWARD', rewardId, {
            request_id: r.id,
            points: 10,
          });
          await notify(db, indication.user_id, r.id, 'REWARD_RECEIVED', 'reward:' + rewardId);
        }
      }
      await log(db, id, 'REQUEST_RESOLVED', 'REQUEST', r.id, {
        type: kind,
        seconds: (Date.now() - Date.parse(r.created_at)) / 1000,
      });
      const [signals] = await rows<{
        requester_resolutions_last_day: number;
        recent_indicants: number;
        recent_account: number;
        repeated_pairs: number;
      }>(
        db,
        `SELECT (SELECT COUNT(*) FROM request_resolutions WHERE resolved_by=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY)) AS requester_resolutions_last_day,
          (SELECT COUNT(*) FROM reward_events e JOIN accounts a ON a.id=e.user_id WHERE e.request_id=? AND a.created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)) AS recent_indicants,
          EXISTS(SELECT 1 FROM accounts WHERE id=? AND created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 7 DAY)) AS recent_account,
          (SELECT COUNT(*) FROM reward_events e JOIN requests r ON r.id=e.request_id WHERE r.requester_id=? AND e.user_id IN (SELECT user_id FROM reward_events WHERE request_id=?)) AS repeated_pairs`,
        [id, r.id, id, id, r.id],
      );
      await log(db, id, 'RESOLUTION_AUDIT_SIGNALS', 'REQUEST', r.id, {
        ...signals,
        recent_account: Boolean(signals.recent_account),
        fast_resolution: Date.now() - Date.parse(r.created_at) < 300000,
      });
      return resolutionId;
    }
    case 'cancel_request': {
      const r = await requestLock(db, p, actor, true);
      if (r.status === 'CANCELED') return;
      if (r.status !== 'OPEN') throw new Error('REQUEST_CLOSED');
      await db.execute(
        "UPDATE requests SET status='CANCELED',canceled_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?",
        [r.id],
      );
      await log(db, id, 'REQUEST_CANCELED', 'REQUEST', r.id);
      return;
    }
    case 'report_content': {
      const kind = text(p.p_target_type),
        target = text(p.p_target_id),
        reason = text(p.p_reason).trim();
      if (reason.length < 10 || reason.length > 500) throw new Error('INVALID_INPUT');
      let allowed = false;
      if (kind === 'REQUEST')
        allowed =
          (await rows(db, 'SELECT id FROM requests WHERE id=? AND hidden_at IS NULL', [target]))
            .length > 0;
      else if (kind === 'INDICATION')
        allowed =
          (
            await rows(
              db,
              `SELECT i.id FROM indications i JOIN requests r ON r.id=i.request_id WHERE i.id=? AND i.hidden_at IS NULL AND r.hidden_at IS NULL AND (i.user_id=? OR (r.requester_id=? AND r.status<>'OPEN'))`,
              [target, id, id],
            )
          ).length > 0;
      if (!allowed) throw new Error('NOT_ALLOWED');
      await rate(db, id, 'reports', 10, 3600);
      await db.execute(
        'INSERT IGNORE INTO reports(id,reporter_id,target_type,target_id,reason) VALUES(?,?,?,?,?)',
        [randomUUID(), id, kind, target, reason],
      );
      await log(db, id, 'CONTENT_REPORTED', kind, target);
      return;
    }
    case 'admin_moderate': {
      admin();
      const action = text(p.p_action),
        target = text(p.p_target_id),
        note = text(p.p_note) || 'Revisão administrativa registrada';
      if (note.trim().length < 10 || note.length > 500) throw new Error('INVALID_INPUT');
      if (['BLOCK_USER', 'UNBLOCK_USER'].includes(action)) {
        if (
          target === id ||
          !(await rows(db, 'SELECT id FROM accounts WHERE id=? FOR UPDATE', [target])).length
        )
          throw new Error('NOT_ALLOWED');
        await db.execute('UPDATE accounts SET blocked=? WHERE id=?', [
          action === 'BLOCK_USER',
          target,
        ]);
        if (action === 'BLOCK_USER')
          await db.execute('DELETE FROM sessions WHERE user_id=?', [target]);
      } else if (action === 'HIDE_REQUEST') {
        await requestLock(db, { p_request_id: target }, actor);
        await db.execute(
          `UPDATE requests SET canceled_at=IF(status IN ('OPEN','REVEALED'),UTC_TIMESTAMP(3),canceled_at),status=IF(status IN ('OPEN','REVEALED'),'CANCELED',status),hidden_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?`,
          [target],
        );
      } else if (action === 'HIDE_INDICATION') {
        const [i] = await rows<{ request_id: string }>(
          db,
          'SELECT request_id FROM indications WHERE id=?',
          [target],
        );
        if (!i) throw new Error('NOT_ALLOWED');
        await requestLock(db, { p_request_id: i.request_id }, actor);
        await db.execute(
          'UPDATE indications SET hidden_at=COALESCE(hidden_at,UTC_TIMESTAMP(3)) WHERE id=?',
          [target],
        );
        await db.execute(
          'UPDATE requests SET indication_count=(SELECT COUNT(*) FROM indications WHERE request_id=? AND hidden_at IS NULL) WHERE id=?',
          [i.request_id, i.request_id],
        );
      } else if (action === 'REVIEW_REPORT')
        await db.execute(
          "UPDATE reports SET status='REVIEWED',reviewed_by=?,reviewed_at=UTC_TIMESTAMP(3),decision_note=? WHERE id=?",
          [id, note, target],
        );
      else throw new Error('INVALID_INPUT');
      await log(db, id, action, 'ADMIN_ACTION', target);
      await log(db, id, 'MODERATION_DECISION', 'ADMIN_ACTION', target, { action, note });
      return;
    }
    case 'set_request_interest':
    case 'set_request_wanted': {
      const r = await requestLock(db, p, actor);
      await rate(db, id, 'interests', 60, 60);
      const [old] = await rows<{ saved: boolean; following: boolean; wanted: boolean }>(
        db,
        'SELECT saved,following,wanted FROM request_interests WHERE user_id=? AND request_id=?',
        [id, r.id],
      );
      const wants = name === 'set_request_wanted';
      if (wants) {
        if (r.requester_id === id) throw new Error('NOT_ALLOWED');
        if (p.p_wanted && !['OPEN', 'REVEALED'].includes(r.status))
          throw new Error('REQUEST_CLOSED');
      }
      const saved = p.p_saved ?? old?.saved ?? false,
        following = wants && p.p_wanted ? true : (p.p_following ?? old?.following ?? false),
        wanted = wants ? p.p_wanted : (old?.wanted ?? false);
      await db.execute(
        'INSERT INTO request_interests(user_id,request_id,saved,following,wanted) VALUES(?,?,?,?,?) ON DUPLICATE KEY UPDATE saved=VALUES(saved),following=VALUES(following),wanted=VALUES(wanted)',
        [id, r.id, Boolean(saved), Boolean(following), Boolean(wanted)],
      );
      await countSync(db, r.id);
      return;
    }
    case 'reconfirm_discovery': {
      const r = await requestLock(db, p, actor);
      if (
        r.requester_id === id ||
        r.status !== 'RESOLVED' ||
        !(
          await rows(
            db,
            "SELECT id FROM request_resolutions WHERE request_id=? AND type='INDICATED_PLACE' AND place_id IS NOT NULL",
            [r.id],
          )
        ).length
      )
        throw new Error('NOT_ALLOWED');
      await rate(db, id, 'reconfirmations', 20, 3600);
      await db.execute(
        'INSERT IGNORE INTO request_reconfirmations(user_id,request_id) VALUES(?,?)',
        [id, r.id],
      );
      await countSync(db, r.id);
      return;
    }
    case 'save_preferences':
      await rate(db, id, 'preferences', 20, 3600);
      await db.execute(
        'INSERT INTO user_preferences(user_id,email_reminders) VALUES(?,?) ON DUPLICATE KEY UPDATE email_reminders=VALUES(email_reminders),updated_at=UTC_TIMESTAMP(3)',
        [id, Boolean(p.p_email_reminders)],
      );
      if (!p.p_email_reminders)
        await db.execute(
          "UPDATE email_jobs SET status='CANCELED',worker_id=NULL,lease_until=NULL WHERE user_id=? AND status IN ('PENDING','PROCESSING')",
          [id],
        );
      return;
    case 'set_followed_city': {
      await rate(db, id, 'followed_cities', 30, 3600);
      const current = await rows<{ city_id: number }>(
        db,
        'SELECT city_id FROM followed_cities WHERE user_id=?',
        [id],
      );
      if (p.p_following) {
        if (current.length >= 8 && !current.some((r) => r.city_id === Number(p.p_city_id)))
          throw new Error('CITY_LIMIT');
        await db.execute('INSERT IGNORE INTO followed_cities(user_id,city_id) VALUES(?,?)', [
          id,
          Number(p.p_city_id),
        ]);
      } else
        await db.execute('DELETE FROM followed_cities WHERE user_id=? AND city_id=?', [
          id,
          Number(p.p_city_id),
        ]);
      return;
    }
    case 'mark_notifications_read':
      await db.execute(
        'UPDATE notifications SET read_at=UTC_TIMESTAMP(3) WHERE user_id=? AND read_at IS NULL AND (? IS NULL OR id=?)',
        [id, p.p_id ? text(p.p_id) : null, p.p_id ? text(p.p_id) : null],
      );
      return;
    case 'add_topic_alert': {
      const term = text(p.p_term).trim(),
        normal = normalizeCity(term);
      if (term.length < 3 || term.length > 80 || !normal) throw new Error('INVALID_INPUT');
      await rate(db, id, 'topic_alerts', 30, 3600);
      const current = await rows<{ city_id: number; normalized_term: string }>(
        db,
        'SELECT city_id,normalized_term FROM topic_alerts WHERE user_id=?',
        [id],
      );
      if (
        current.length >= 12 &&
        !current.some((r) => r.city_id === Number(p.p_city_id) && r.normalized_term === normal)
      )
        throw new Error('TOPIC_LIMIT');
      await db.execute(
        'INSERT IGNORE INTO topic_alerts(id,user_id,city_id,term,normalized_term) VALUES(?,?,?,?,?)',
        [randomUUID(), id, Number(p.p_city_id), term, normal],
      );
      return;
    }
    case 'remove_topic_alert':
      await rate(db, id, 'topic_alerts', 30, 3600);
      await db.execute('DELETE FROM topic_alerts WHERE user_id=? AND id=?', [id, text(p.p_id)]);
      return;
    case 'record_search_event': {
      const kind = text(p.p_kind),
        request = p.p_request_id ? text(p.p_request_id) : null,
        city = Number(p.p_city_id);
      if (!['MATCHED', 'NO_RESULT', 'CLICKED', 'USEFUL'].includes(kind))
        throw new Error('INVALID_INPUT');
      if (['CLICKED', 'USEFUL'].includes(kind)) {
        if (
          !(
            await rows(
              db,
              "SELECT r.id FROM requests r JOIN request_resolutions s ON s.request_id=r.id WHERE r.id=? AND r.city_id=? AND r.hidden_at IS NULL AND r.status='RESOLVED'",
              [request, city],
            )
          ).length
        )
          throw new Error('NOT_ALLOWED');
      } else if (request) throw new Error('INVALID_INPUT');
      if (
        (
          await rows(
            db,
            "SELECT id FROM search_events WHERE user_id=? AND city_id=? AND kind=? AND request_id <=> ? AND (kind='USEFUL' OR created_at>DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 30 SECOND))",
            [id, city, kind, request],
          )
        ).length
      )
        return;
      await rate(db, id, 'search_events', 60, 60);
      await db.execute(
        'INSERT IGNORE INTO search_events(id,user_id,city_id,request_id,kind) VALUES(?,?,?,?,?)',
        [randomUUID(), id, city, request, kind],
      );
      return;
    }
    case 'record_analytics': {
      const event = text(p.p_event),
        fingerprint = text(p.p_fingerprint);
      if (
        !['LANDING_VISIT', 'CTA_CLICK', 'SEARCH_REUSED'].includes(event) ||
        !/^[a-f0-9]{64}$/.test(fingerprint)
      )
        throw new Error('INVALID_INPUT');
      await rate(db, fingerprint, 'analytics', 60, 60);
      await db.execute(
        'INSERT INTO analytics(day,event,hits) VALUES(UTC_DATE(),?,1) ON DUPLICATE KEY UPDATE hits=hits+1',
        [event],
      );
      return;
    }
    case 'request_support': {
      const kind = text(p.p_kind),
        reason = text(p.p_reason).trim();
      if (
        !['CLOSE_ACCOUNT', 'DATA_HELP'].includes(kind) ||
        reason.length < 10 ||
        reason.length > 500
      )
        throw new Error('INVALID_INPUT');
      if (kind === 'CLOSE_ACCOUNT' && actor?.admin) throw new Error('ADMIN_ACCOUNT');
      await rate(db, id, 'support', 5, 3600);
      const supportId = randomUUID();
      await db.execute('INSERT INTO support_requests(id,user_id,kind,reason) VALUES(?,?,?,?)', [
        supportId,
        id,
        kind,
        reason,
      ]);
      await log(db, id, 'SUPPORT_REQUESTED', 'SUPPORT', supportId, { kind });
      return supportId;
    }
    case 'admin_review_support': {
      admin();
      const [support] = await rows<{ kind: string; status: string }>(
        db,
        'SELECT kind,status FROM support_requests WHERE id=? FOR UPDATE',
        [text(p.p_id)],
      );
      const decision = text(p.p_decision),
        note = text(p.p_note).trim();
      if (!support || !['OPEN', 'PROCESSING'].includes(support.status))
        throw new Error('NOT_ALLOWED');
      if (!['COMPLETED', 'DECLINED'].includes(decision) || note.length < 10 || note.length > 500)
        throw new Error('INVALID_INPUT');
      if (
        support.kind === 'CLOSE_ACCOUNT' &&
        (decision === 'COMPLETED' || support.status === 'PROCESSING')
      )
        throw new Error('CLOSURE_REQUIRED');
      await db.execute(
        'UPDATE support_requests SET status=?,reviewer_id=?,decision_note=?,reviewed_at=UTC_TIMESTAMP(3) WHERE id=?',
        [decision, id, note, text(p.p_id)],
      );
      await log(db, id, 'SUPPORT_REVIEWED', 'SUPPORT', text(p.p_id), { decision });
      return;
    }
    case 'prepare_account_closure': {
      admin();
      const [support] = await rows<{ user_id: string; kind: string; status: string }>(
        db,
        'SELECT user_id,kind,status FROM support_requests WHERE id=? FOR UPDATE',
        [text(p.p_id)],
      );
      if (
        !support ||
        support.kind !== 'CLOSE_ACCOUNT' ||
        !['OPEN', 'PROCESSING'].includes(support.status) ||
        support.user_id === id
      )
        throw new Error('NOT_ALLOWED');
      const [account] = await rows<{ is_admin: boolean }>(
        db,
        'SELECT is_admin FROM accounts WHERE id=? FOR UPDATE',
        [support.user_id],
      );
      if (account.is_admin) throw new Error('ADMIN_ACCOUNT');
      await db.execute('UPDATE accounts SET blocked=TRUE WHERE id=?', [support.user_id]);
      await db.execute('DELETE FROM sessions WHERE user_id=?', [support.user_id]);
      await db.execute("UPDATE support_requests SET status='PROCESSING',reviewer_id=? WHERE id=?", [
        id,
        text(p.p_id),
      ]);
      return support.user_id;
    }
    case 'complete_account_closure':
      admin();
      return closeAccount(db, id, p);
    case 'export_account': {
      await rate(db, id, 'data_export', 3, 3600);
      const result: Record<string, unknown> = { version: 3, exported_at: new Date().toISOString() };
      const exports: Record<string, [string, string]> = {
        profile: ['profiles', 'id'],
        places: ['places', 'created_by'],
        requests: ['requests', 'requester_id'],
        indications: ['indications', 'user_id'],
        resolutions: ['request_resolutions', 'resolved_by'],
        rewards: ['reward_events', 'user_id'],
        reports: ['reports', 'reporter_id'],
        preferences: ['user_preferences', 'user_id'],
        followed_cities: ['followed_cities', 'user_id'],
        interests: ['request_interests', 'user_id'],
        support: ['support_requests', 'user_id'],
        topic_alerts: ['topic_alerts', 'user_id'],
        reconfirmations: ['request_reconfirmations', 'user_id'],
        notifications: ['notifications', 'user_id'],
        search_events: ['search_events', 'user_id'],
        audit_logs: ['audit_logs', 'actor_id'],
      };
      for (const [key, [table, column]] of Object.entries(exports)) {
        const data = await rows(db, `SELECT * FROM ${table} WHERE ${column}=?`, [id]);
        result[key] = ['profile', 'preferences'].includes(key) ? data[0] || null : data;
      }
      const photos = await rows<{ request_id: string; jpeg: Buffer; updated_at: string }>(
        db,
        'SELECT p.* FROM request_photos p JOIN requests r ON r.id=p.request_id WHERE r.requester_id=?',
        [id],
      );
      result.photos = photos.map((p) => ({
        request_id: p.request_id,
        jpeg_base64: p.jpeg.toString('base64'),
        updated_at: p.updated_at,
      }));
      await log(db, id, 'DATA_EXPORTED', 'ACCOUNT', id);
      return result;
    }
    case 'refresh_reminders':
      return prepareReminders(db, id, false);
    case 'prepare_reminders':
      return prepareReminders(db, null, true);
    case 'claim_email_jobs':
      return claimJobs(db, p);
    case 'email_job_eligible':
      return jobEligible(db, p);
    case 'finish_email_job': {
      await db.execute(
        `UPDATE email_jobs SET status=IF(?,'SENT',IF(attempts>=5,'CANCELED','PENDING')),sent_at=IF(?,UTC_TIMESTAMP(3),NULL),worker_id=NULL,lease_until=NULL,next_attempt_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 10 MINUTE) WHERE id=? AND worker_id=? AND status='PROCESSING'`,
        [Boolean(p.p_sent), Boolean(p.p_sent), text(p.p_id), text(p.p_worker)],
      );
      return;
    }
    default:
      throw new Error('NOT_ALLOWED');
  }
}
async function closeAccount(db: PoolConnection, admin: string, p: Args) {
  const [support] = await rows<{
      user_id: string;
      kind: string;
      status: string;
      reviewer_id: string;
    }>(db, 'SELECT user_id,kind,status,reviewer_id FROM support_requests WHERE id=? FOR UPDATE', [
      text(p.p_id),
    ]),
    note = text(p.p_note).trim();
  if (
    !support ||
    support.kind !== 'CLOSE_ACCOUNT' ||
    support.status !== 'PROCESSING' ||
    support.reviewer_id !== admin
  )
    throw new Error('NOT_ALLOWED');
  if (note.length < 10 || note.length > 500) throw new Error('INVALID_INPUT');
  const user = support.user_id;
  await db.query('SET @goindica_anonymizing=1');
  const impacted = await rows<{ id: string }>(
    db,
    'SELECT r.id FROM requests r WHERE r.requester_id=? OR r.id IN (SELECT request_id FROM request_interests WHERE user_id=?) OR r.id IN (SELECT request_id FROM request_reconfirmations WHERE user_id=?) ORDER BY r.id FOR UPDATE',
    [user, user, user],
  );
  await db.execute(
    'UPDATE users SET email=NULL,password_hash=NULL,deleted_at=UTC_TIMESTAMP(3) WHERE id=?',
    [user],
  );
  await db.execute('DELETE FROM sessions WHERE user_id=?', [user]);
  await db.execute('DELETE FROM auth_tokens WHERE user_id=?', [user]);
  await db.execute(
    `UPDATE requests SET description='Pedido de conta encerrada',neighborhood=NULL,canceled_at=IF(status IN ('OPEN','REVEALED'),UTC_TIMESTAMP(3),canceled_at),status=IF(status IN ('OPEN','REVEALED'),'CANCELED',status),has_photo=FALSE,photo_updated_at=NULL,updated_at=UTC_TIMESTAMP(3) WHERE requester_id=?`,
    [user],
  );
  await db.execute('UPDATE indications SET comment=NULL WHERE user_id=?', [user]);
  await db.execute(
    "UPDATE profiles SET username=?,display_name='Conta encerrada',updated_at=UTC_TIMESTAMP(3) WHERE id=?",
    ['deleted_' + randomUUID().replaceAll('-', '').slice(0, 16), user],
  );
  await db.execute(
    "UPDATE reports SET reason='Conteúdo anonimizado a pedido do titular' WHERE reporter_id=?",
    [user],
  );
  for (const table of [
    'user_preferences',
    'followed_cities',
    'request_interests',
    'notifications',
    'search_events',
    'topic_alerts',
    'request_reconfirmations',
  ])
    await db.execute(`DELETE FROM ${table} WHERE user_id=?`, [user]);
  await db.execute(
    'DELETE p FROM request_photos p JOIN requests r ON r.id=p.request_id WHERE r.requester_id=?',
    [user],
  );
  await db.execute(
    "UPDATE email_jobs SET status='CANCELED',worker_id=NULL,lease_until=NULL WHERE user_id=? AND status IN ('PENDING','PROCESSING')",
    [user],
  );
  await db.execute(
    "UPDATE support_requests SET reason='Solicitação de conta encerrada',status=IF(id=?,'COMPLETED','DECLINED'),reviewer_id=?,decision_note=IF(id=?,?,'Conta encerrada por solicitação do titular'),reviewed_at=UTC_TIMESTAMP(3) WHERE user_id=?",
    [text(p.p_id), admin, text(p.p_id), note, user],
  );
  for (const r of impacted) await countSync(db, r.id);
  await log(db, admin, 'ACCOUNT_ANONYMIZED', 'SUPPORT', text(p.p_id));
}
async function prepareReminders(db: PoolConnection, user: string | null, email: boolean) {
  const requests = await rows<{ id: string; requester_id: string }>(
    db,
    `SELECT r.id,r.requester_id FROM requests r JOIN accounts a ON a.id=r.requester_id WHERE a.blocked=FALSE AND r.hidden_at IS NULL AND (r.status='REVEALED' OR (r.status='OPEN' AND r.indication_count>0)) AND COALESCE(r.responses_revealed_at,r.updated_at)<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) AND (? IS NULL OR r.requester_id=?)`,
    [user, user],
  );
  const [date] = await rows<{ week: string }>(
    db,
    "SELECT DATE_FORMAT(UTC_TIMESTAMP(),'%x-%v') AS week",
  );
  let prepared = 0;
  for (const r of requests) {
    await notify(
      db,
      r.requester_id,
      r.id,
      'DECISION_REMINDER',
      'reminder:' + r.id + ':' + date.week,
    );
    if (email) {
      const [result] = await db.execute<import('mysql2').ResultSetHeader>(
        `INSERT IGNORE INTO email_jobs(id,user_id,request_id,week) SELECT ?,?,?,? FROM user_preferences WHERE user_id=? AND email_reminders=TRUE`,
        [randomUUID(), r.requester_id, r.id, date.week, r.requester_id],
      );
      prepared += result.affectedRows;
    }
  }
  return prepared;
}
async function jobEligible(db: PoolConnection, p: Args) {
  const [r] = await rows<{ eligible: boolean }>(
    db,
    `SELECT EXISTS(SELECT 1 FROM email_jobs j JOIN user_preferences p ON p.user_id=j.user_id JOIN requests r ON r.id=j.request_id JOIN accounts a ON a.id=j.user_id WHERE j.id=? AND j.worker_id=? AND j.status='PROCESSING' AND j.lease_until>UTC_TIMESTAMP(3) AND p.email_reminders=TRUE AND a.blocked=FALSE AND r.hidden_at IS NULL AND (r.status='REVEALED' OR (r.status='OPEN' AND r.indication_count>0))) AS eligible`,
    [text(p.p_id), text(p.p_worker)],
  );
  return r.eligible;
}
async function claimJobs(db: PoolConnection, p: Args) {
  await db.execute(
    `UPDATE email_jobs j SET status='CANCELED',worker_id=NULL,lease_until=NULL WHERE j.status IN ('PENDING','PROCESSING') AND ((j.attempts>=5 AND (j.status='PENDING' OR j.lease_until<UTC_TIMESTAMP(3))) OR j.first_attempt_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 23 HOUR) OR NOT EXISTS(SELECT 1 FROM accounts a WHERE a.id=j.user_id AND a.blocked=FALSE) OR NOT EXISTS(SELECT 1 FROM user_preferences p WHERE p.user_id=j.user_id AND p.email_reminders=TRUE) OR NOT EXISTS(SELECT 1 FROM requests r WHERE r.id=j.request_id AND r.hidden_at IS NULL AND (r.status='REVEALED' OR (r.status='OPEN' AND r.indication_count>0))))`,
  );
  const jobs = await rows<{ id: string; user_id: string; request_id: string }>(
    db,
    `SELECT id,user_id,request_id FROM email_jobs WHERE ((status='PENDING' AND next_attempt_at<=UTC_TIMESTAMP(3)) OR (status='PROCESSING' AND lease_until<UTC_TIMESTAMP(3))) AND attempts<5 ORDER BY created_at,id LIMIT ${Math.max(1, int(p.p_limit || 5, 20))} FOR UPDATE SKIP LOCKED`,
  );
  for (const job of jobs)
    await db.execute(
      "UPDATE email_jobs SET status='PROCESSING',worker_id=?,lease_until=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE),attempts=attempts+1,first_attempt_at=COALESCE(first_attempt_at,UTC_TIMESTAMP(3)) WHERE id=?",
      [text(p.p_worker), job.id],
    );
  return jobs;
}
