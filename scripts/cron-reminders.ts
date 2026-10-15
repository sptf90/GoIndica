import { loadEnvironment } from './lib/environment';
loadEnvironment();
const url = process.env.NEXT_PUBLIC_APP_URL,
  secret = process.env.CRON_SECRET;
if (!url || !secret || secret.length < 32) throw new Error('Configure domínio e CRON_SECRET.');
const response = await fetch(new URL('/api/cron/reminders', url), {
  method: 'POST',
  headers: { Authorization: 'Bearer ' + secret },
  signal: AbortSignal.timeout(60000),
});
if (!response.ok) throw new Error('Falha na execução dos lembretes: ' + response.status);
console.log(await response.json());
