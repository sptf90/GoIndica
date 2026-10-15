import mysql, { type RowDataPacket } from 'mysql2/promise';
import { readFile } from 'node:fs/promises';
import { loadEnvironment } from './lib/environment';
loadEnvironment();
const file = process.argv.find((v) => v.startsWith('--input='))?.slice(8);
if (!file) throw new Error('Use --input=.migration-data/supabase-export.json');
const snapshot = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>;
if (
  !snapshot ||
  snapshot.version !== 1 ||
  [
    'users',
    'accounts',
    'profiles',
    'requests',
    'places',
    'indications',
    'request_resolutions',
    'reward_events',
  ].some((table) => !Array.isArray(snapshot[table]))
)
  throw new Error('Formato de exportação inválido. Use o exportador do projeto.');
const data = snapshot as Record<string, Record<string, unknown>[]>;
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: 'utf8mb4',
  timezone: 'Z',
  ...(process.env.MYSQL_SSL === 'true' ? { ssl: { rejectUnauthorized: true } } : {}),
});
try {
  await db.query("SET time_zone='+00:00'");
  await db.beginTransaction();
  const [existing] = await db.query<RowDataPacket[]>(
    'SELECT (SELECT COUNT(*) FROM users)+(SELECT COUNT(*) FROM requests) AS hits',
  );
  if (existing[0].hits > 0)
    throw new Error(
      'Importação exige banco sem usuários e pedidos; nenhuma informação será sobrescrita.',
    );
  for (const city of data.cities || []) {
    const keys = [
      'id',
      'name',
      'normalized_name',
      'state_name',
      'state_code',
      'country_name',
      'country_code',
      'slug',
    ];
    await db.execute(
      'INSERT INTO cities (' +
        keys.join(',') +
        ') VALUES (' +
        keys.map(() => '?').join(',') +
        ') ON DUPLICATE KEY UPDATE ' +
        keys
          .slice(1)
          .map((k) => k + '=VALUES(' + k + ')')
          .join(','),
      keys.map((k) => {
        const value = city[k];
        if (typeof value === 'string' || typeof value === 'number' || value === null) return value;
        throw new Error('Município inválido na exportação.');
      }),
    );
  }
  const tables = [
    'users',
    'accounts',
    'profiles',
    'profile_photos',
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
    'analytics',
    'search_events',
    'email_jobs',
    'request_photos',
  ];
  // Snapshot inserts include completed requests. Backstops remain active for normal application writes.
  await db.query('SET @goindica_importing=1');
  for (const table of tables) {
    const [columns] = await db.query<RowDataPacket[]>('SHOW COLUMNS FROM `' + table + '`');
    const allowed = new Set(
      columns
        .filter((c) => !/(?:STORED|VIRTUAL) GENERATED/.test(String(c.Extra)))
        .map((c) => String(c.Field)),
    );
    for (const source of data[table] || []) {
      const row = { ...source };
      if (table === 'users')
        row.email =
          typeof row.email === 'string' && row.email.trim() ? row.email.trim().toLowerCase() : null;
      if (table === 'profiles')
        row.avatar_url = (data.profile_photos || []).some((photo) => photo.user_id === row.id)
          ? '/api/profile-photo?id=' + String(row.id)
          : null;
      if (
        table === 'users' &&
        typeof row.password_hash === 'string' &&
        !row.password_hash.startsWith('$2') &&
        !row.password_hash.startsWith('scrypt:')
      )
        row.password_hash = null;
      if (table === 'places') {
        row.legacy_google_place_id =
          typeof row.google_place_id === 'string' ? row.google_place_id : null;
        // The former provider stored identifiers only. No external business metadata is fabricated or fetched.
        row.name = typeof row.name === 'string' ? row.name : 'Estabelecimento migrado';
        row.address =
          typeof row.address === 'string' ? row.address : 'Endereço pendente de cadastro';
        row.normalized_name = 'estabelecimento migrado ' + String(row.id);
        row.created_by = null;
        row.hidden_at = null;
      }
      if (table === 'request_photos' || table === 'profile_photos') {
        row.jpeg = Buffer.from(String(row.jpeg_base64).replace(/\s/g, ''), 'base64');
        delete row.jpeg_base64;
      }
      if (table === 'email_jobs' && row.status === 'PROCESSING') {
        row.status = 'PENDING';
        row.worker_id = null;
        row.lease_until = null;
      }
      const keys = Object.keys(row).filter((k) => allowed.has(k));
      const values = keys.map((k) => {
        const value = row[k];
        if (value !== null && typeof value === 'object' && !Buffer.isBuffer(value))
          return JSON.stringify(value);
        if (
          typeof value === 'string' &&
          /_(?:at|start|until)$/.test(k) &&
          /^\d{4}-\d\d-\d\dT/.test(value)
        )
          return new Date(value);
        if (
          value === null ||
          typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          Buffer.isBuffer(value)
        )
          return value;
        throw new Error('Valor inválido na exportação: ' + table + '.' + k);
      });
      await db.execute(
        'INSERT INTO `' +
          table +
          '` (' +
          keys.map((k) => '`' + k + '`').join(',') +
          ') VALUES (' +
          keys.map(() => '?').join(',') +
          ')',
        values,
      );
    }
    const [count] = await db.query<RowDataPacket[]>('SELECT COUNT(*) AS hits FROM `' + table + '`');
    if (Number(count[0].hits) !== (data[table] || []).length)
      throw new Error('Contagem divergente: ' + table);
  }
  await db.query('SET @goindica_importing=0');
  await db.commit();
  console.log(
    'Importação concluída e contagens conferidas. Senhas bcrypt preservadas; sessões antigas não foram transferidas.',
  );
  console.log(
    'Estabelecimentos históricos precisam de nome/endereço no cadastro local. Fotos de perfil foram copiadas para o banco local quando disponíveis.',
  );
} catch (error) {
  await db.rollback();
  throw error;
} finally {
  await db.query('SET @goindica_importing=0');
  await db.end();
}
