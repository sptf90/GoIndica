import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceClient } from '@/lib/supabase/admin';
import { requiredEnv, appUrl } from '@/lib/env';
import { check } from '@/lib/errors';
import { operationalError } from '@/lib/observability';
export async function runReminders() {
  const key = requiredEnv('RESEND_API_KEY'),
    from = requiredEnv('EMAIL_FROM'),
    db = serviceClient();
  const prepared = check(await db.rpc('prepare_reminders')),
    worker = randomUUID();
  // 5 jobs per invocation keep provider timeouts inside common server limits.
  const jobs = check(await db.rpc('claim_email_jobs', { p_worker: worker, p_limit: 5 }));
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    try {
      const { user } = check(await db.auth.admin.getUserById(job.user_id));
      if (!user?.email) throw new Error('EMAIL_UNAVAILABLE');
      if (!check(await db.rpc('email_job_eligible', { p_id: job.id, p_worker: worker }))) {
        check(await db.rpc('finish_email_job', { p_id: job.id, p_worker: worker, p_sent: false }));
        continue;
      }
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
        headers: {
          Authorization: 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Idempotency-Key': 'reminder/' + job.id,
        },
        body: JSON.stringify({
          from,
          to: [user.email],
          subject: 'Há um pedido aguardando sua decisão no GoIndica',
          text:
            'Sua cidade respondeu. Confira seu pedido e registre o resultado quando puder.\n\n' +
            appUrl() +
            '/pedidos/' +
            job.request_id +
            '\n\nPara desativar estes lembretes: ' +
            appUrl() +
            '/preferencias',
        }),
      });
      if (!response.ok) throw new Error('EMAIL_DELIVERY_FAILED');
      check(await db.rpc('finish_email_job', { p_id: job.id, p_worker: worker, p_sent: true }));
      sent++;
    } catch (e) {
      failed++;
      operationalError('reminders.delivery', e);
      const result = await db.rpc('finish_email_job', {
        p_id: job.id,
        p_worker: worker,
        p_sent: false,
      });
      if (result.error) operationalError('reminders.release', result.error);
    }
  }
  return { prepared, sent, failed };
}
