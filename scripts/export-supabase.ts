// One-time offline export. The running application never connects to Supabase.
import { Pool } from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import sharp from 'sharp';
import { loadEnvironment } from './lib/environment';
loadEnvironment();
const connection = process.env.SOURCE_POSTGRES_URL;
if (!connection) throw new Error('Configure SOURCE_POSTGRES_URL only for this export.');
const destination =
  process.argv.find((v) => v.startsWith('--output='))?.slice(9) ||
  '.migration-data/supabase-export.json';
const db = new Pool({ connectionString: connection, max: 1 });
const client = await db.connect();
try {
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const output: Record<string, unknown> = { version: 1, exported_at: new Date().toISOString() };
  output.users = (
    await client.query(
      'SELECT id,email,encrypted_password AS password_hash,email_confirmed_at,deleted_at,created_at,last_sign_in_at FROM auth.users',
    )
  ).rows;
  const tables = [
    'cities',
    'profiles',
    'requests',
    'places',
    'indications',
    'request_resolutions',
    'reward_events',
    'reports',
    'audit_logs',
    'user_preferences',
    'followed_cities',
    'request_interests',
    'notifications',
    'support_requests',
    'topic_alerts',
    'request_reconfirmations',
  ];
  for (const table of tables)
    output[table] = (await client.query('SELECT * FROM public.' + table)).rows;
  for (const table of ['accounts', 'rate_limits', 'analytics', 'search_events', 'email_jobs'])
    output[table] = (await client.query('SELECT * FROM private.' + table)).rows;
  output.request_photos = (
    await client.query(
      "SELECT request_id,encode(jpeg,'base64') AS jpeg_base64,updated_at FROM private.request_photos",
    )
  ).rows;
  const photos: { user_id: string; jpeg_base64: string }[] = [];
  for (const profile of output.profiles as { id: string; avatar_url: string | null }[]) {
    if (!profile.avatar_url) continue;
    const url = new URL(profile.avatar_url);
    if (url.protocol !== 'https:' || !/^lh[0-9]+\.googleusercontent\.com$/.test(url.hostname))
      throw new Error('Origem de foto de perfil não reconhecida.');
    const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(10000) });
    if (!response.ok || Number(response.headers.get('content-length')) > 5 * 1024 * 1024)
      throw new Error('Não foi possível preservar uma foto de perfil.');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > 5 * 1024 * 1024) throw new Error('Foto de perfil excede 5 MB.');
    const jpeg = await sharp(buffer, { limitInputPixels: 20000000 })
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 85 })
      .toBuffer();
    photos.push({ user_id: profile.id, jpeg_base64: jpeg.toString('base64') });
  }
  output.profile_photos = photos;
  await client.query('COMMIT');
  await mkdir(dirname(destination), { recursive: true, mode: 0o700 });
  await writeFile(destination, JSON.stringify(output), { mode: 0o600 });
  console.log(
    'Exportação consistente salva em arquivo privado. Usuários:',
    (output.users as unknown[]).length,
    'Pedidos:',
    (output.requests as unknown[]).length,
  );
} finally {
  client.release();
  await db.end();
}
