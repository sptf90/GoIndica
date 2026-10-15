import 'server-only';
import { randomUUID } from 'node:crypto';
import { serviceClient } from '@/lib/database/admin';
import { pool, rows } from '@/lib/database/pool';
import { appUrl } from '@/lib/env';
import { check } from '@/lib/errors';
import { operationalError } from '@/lib/observability';
import { sendMail } from '@/lib/mail/smtp';
export async function runReminders() {
  const db = serviceClient();
  const prepared = check(await db.call('prepare_reminders')),
    worker = randomUUID();
  const jobs = check(await db.call('claim_email_jobs', { p_worker: worker, p_limit: 5 }));
  let sent = 0,
    failed = 0;
  for (const job of jobs) {
    try {
      const [user] = await rows<{ email: string }>(
        pool(),
        'SELECT email FROM users WHERE id=? AND deleted_at IS NULL',
        [job.user_id],
      );
      if (!user?.email) throw new Error('EMAIL_UNAVAILABLE');
      if (!check(await db.call('email_job_eligible', { p_id: job.id, p_worker: worker }))) {
        check(await db.call('finish_email_job', { p_id: job.id, p_worker: worker, p_sent: false }));
        continue;
      }
      await sendMail(
        user.email,
        'Há um pedido aguardando sua decisão no GoIndica',
        'Sua cidade respondeu. Confira seu pedido e registre o resultado quando puder.\n\n' +
          appUrl() +
          '/pedidos/' +
          job.request_id +
          '\n\nPara desativar estes lembretes: ' +
          appUrl() +
          '/preferencias',
        `<reminder-${job.id}@${new URL(appUrl()).hostname}>`,
      );
      check(await db.call('finish_email_job', { p_id: job.id, p_worker: worker, p_sent: true }));
      sent++;
    } catch (error) {
      failed++;
      operationalError('reminders.delivery', error);
      const result = await db.call('finish_email_job', {
        p_id: job.id,
        p_worker: worker,
        p_sent: false,
      });
      if (result.error) operationalError('reminders.release', result.error);
    }
  }
  return { prepared, sent, failed };
}
