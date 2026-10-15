// Portable private dump for phpMyAdmin when SSH/Remote MySQL is unavailable.
import mysql, { type RowDataPacket } from 'mysql2/promise';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { loadEnvironment } from './lib/environment';
loadEnvironment();
const db = await mysql.createConnection({
  host: process.env.MYSQL_HOST,
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: 'utf8mb4',
  timezone: 'Z',
});
const output =
  process.argv.find((v) => v.startsWith('--output='))?.slice(9) ||
  '.migration-data/hostinger-import.sql';
try {
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
  await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const [tables] = await db.query<RowDataPacket[]>(
    "SHOW FULL TABLES WHERE Table_type='BASE TABLE'",
  );
  const names = tables.map((t) => String(Object.values(t)[0]));
  let sql =
    "SET NAMES utf8mb4;\nSET time_zone='+00:00';\nSET FOREIGN_KEY_CHECKS=0;\nSET @goindica_importing=1;\n";
  for (const name of names) {
    if (!/^[a-z_]+$/.test(name)) throw new Error('Nome de tabela inválido.');
    const [ddl] = await db.query<RowDataPacket[]>('SHOW CREATE TABLE `' + name + '`');
    sql += String(ddl[0]['Create Table']) + ';\n';
  }
  sql += 'START TRANSACTION;\n';
  for (const name of names) {
    const [columns] = await db.query<RowDataPacket[]>('SHOW COLUMNS FROM `' + name + '`');
    const fields = columns
      .filter((c) => !/(?:STORED|VIRTUAL) GENERATED/.test(String(c.Extra)))
      .map((c) => String(c.Field));
    const [records] = await db.query<RowDataPacket[]>(
      'SELECT ' + fields.map((f) => '`' + f + '`').join(',') + ' FROM `' + name + '`',
    );
    for (const row of records)
      sql +=
        'INSERT INTO `' +
        name +
        '` (' +
        fields.map((f) => '`' + f + '`').join(',') +
        ') VALUES (' +
        fields
          .map((f) =>
            mysql.escape(
              row[f] !== null &&
                typeof row[f] === 'object' &&
                !(row[f] instanceof Date) &&
                !Buffer.isBuffer(row[f])
                ? JSON.stringify(row[f])
                : row[f],
              false,
              'Z',
            ),
          )
          .join(',') +
        ');\n';
  }
  sql += 'COMMIT;\nSET FOREIGN_KEY_CHECKS=1;\nSET @goindica_importing=0;\n';
  const [triggers] = await db.query<RowDataPacket[]>('SHOW TRIGGERS');
  sql += 'DELIMITER $$\n';
  for (const trigger of triggers)
    sql += `CREATE TRIGGER \`${trigger.Trigger}\` ${trigger.Timing} ${trigger.Event} ON \`${trigger.Table}\` FOR EACH ROW ${trigger.Statement}$$\n`;
  sql += 'DELIMITER ;\n';
  await db.commit();
  await mkdir(dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, sql, { mode: 0o600 });
  console.log('Dump SQL privado criado para importação em banco vazio.');
} finally {
  await db.end();
}
