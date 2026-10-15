import mysql from 'mysql2/promise';
import { loadEnvironment } from './lib/environment';
loadEnvironment();
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});
try {
  await db.execute('DELETE FROM sessions WHERE expires_at<UTC_TIMESTAMP(3)');
  await db.execute('DELETE FROM auth_tokens WHERE expires_at<UTC_TIMESTAMP(3)');
  await db.execute(
    'DELETE FROM rate_limits WHERE window_start<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 2 DAY)',
  );
  console.log('Sessões, tokens e contadores expirados removidos.');
} finally {
  await db.end();
}
