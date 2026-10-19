import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Connection } from 'mysql2/promise';
export async function migrate(db: Connection) {
  await db.query("SET time_zone = '+00:00'");
  await db.query('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
  const [lock] = await db.query<import('mysql2').RowDataPacket[]>(
    "SELECT GET_LOCK('goindica-migrations',10) AS acquired",
  );
  if (lock[0].acquired !== 1) throw new Error('Another migration is running.');
  try {
    await db.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(name VARCHAR(190) PRIMARY KEY,checksum CHAR(64) NOT NULL,applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)) ENGINE=InnoDB',
    );
    for (const file of (await readdir('database/migrations'))
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      const sql = await readFile('database/migrations/' + file, 'utf8'),
        checksum = createHash('sha256').update(sql).digest('hex');
      const [applied] = await db.execute<import('mysql2').RowDataPacket[]>(
        'SELECT checksum FROM schema_migrations WHERE name=?',
        [file],
      );
      if (applied.length) {
        if (applied[0].checksum !== checksum)
          throw new Error('Previously applied migration was modified: ' + file);
        continue;
      }
      // DDL auto-commits in MySQL. Abort on error; never continue after a partial schema change.
      // Statements are split outside quoted strings, so city names can contain punctuation.
      for (const statement of statements(sql)) await db.query(statement);
      await db.execute('INSERT INTO schema_migrations(name,checksum) VALUES(?,?)', [
        file,
        checksum,
      ]);
    }
  } finally {
    await db.query("SELECT RELEASE_LOCK('goindica-migrations')");
  }
}
function statements(sql: string) {
  const output: string[] = [];
  let start = 0,
    delimiter = ';';
  for (const match of sql.matchAll(/^DELIMITER\s+(\S+)\s*$/gm)) {
    output.push(...splitStatements(sql.slice(start, match.index), delimiter));
    delimiter = match[1];
    start = match.index! + match[0].length;
  }
  output.push(...splitStatements(sql.slice(start), delimiter));
  return output;
}
function splitStatements(sql: string, delimiter: string) {
  const list: string[] = [];
  let start = 0,
    quote = '',
    lineComment = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i],
      next = sql[i + 1];
    if (lineComment) {
      if (c === '\n') lineComment = false;
      continue;
    }
    if (quote) {
      if (c === quote) {
        if (next === quote) {
          i++;
          continue;
        }
        quote = '';
      } else if (c === '\\') i++;
      continue;
    }
    if (c === '-' && next === '-' && (sql[i + 2] === ' ' || sql[i + 2] === '\n')) {
      lineComment = true;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      continue;
    }
    if (sql.startsWith(delimiter, i)) {
      const statement = sql.slice(start, i).trim();
      if (statement) list.push(statement);
      i += delimiter.length - 1;
      start = i + 1;
    }
  }
  const tail = sql.slice(start).trim();
  if (tail.replace(/--[^\n]*/g, '').trim()) list.push(tail);
  return list;
}
