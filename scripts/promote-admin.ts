import mysql from 'mysql2/promise';
import { loadEnvironment } from './lib/environment';
loadEnvironment();
const username = process.argv.find((v) => v.startsWith('--username='))?.slice(11);
if (!username || !/^[a-z][a-z0-9_]{2,23}$/.test(username))
  throw new Error('Use --username=nome_do_usuario');
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
});
try {
  const [result] = await db.execute<import('mysql2').ResultSetHeader>(
    'UPDATE accounts a JOIN profiles p ON p.id=a.id SET a.is_admin=TRUE WHERE p.username=? AND a.blocked=FALSE',
    [username],
  );
  if (result.affectedRows !== 1) throw new Error('Nenhum perfil ativo encontrado.');
  console.log('Administrador configurado.');
} finally {
  await db.end();
}
