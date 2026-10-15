import mysql from 'mysql2/promise';
import { loadEnvironment } from './lib/environment';
import { migrate } from './lib/migrations';
loadEnvironment();
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
  await migrate(db);
  console.log('MySQL preparado; migrations aplicadas e catálogo de cidades instalado.');
} finally {
  await db.end();
}
