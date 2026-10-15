import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomBytes } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import mysql from 'mysql2/promise';
import { migrate } from '../../scripts/lib/migrations';
const exec = promisify(execFile);
export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL)
    throw new Error('Use disposable Docker MySQL for tests; no existing database is modified.');
  const image = process.env.TEST_MYSQL_IMAGE || 'mysql:8.4';
  if (!['mysql:8.4', 'mariadb:10.11'].includes(image))
    throw new Error('Unsupported disposable test image.');
  const directory = await mkdtemp(join(tmpdir(), 'goindica-mysql-')),
    password = randomBytes(24).toString('hex'),
    name = 'goindica-test-' + randomBytes(6).toString('hex');
  const envfile = join(directory, 'mysql.env');
  await writeFile(envfile, `MYSQL_ROOT_PASSWORD=${password}\nMYSQL_DATABASE=goindica_test\n`, {
    mode: 0o600,
  });
  let db: mysql.Pool | undefined;
  try {
    await exec('docker', [
      'run',
      '-d',
      '--rm',
      '--name',
      name,
      '--env-file',
      envfile,
      '-p',
      '127.0.0.1::3306',
      image,
    ]);
    const { stdout } = await exec('docker', ['port', name, '3306/tcp']);
    const port = Number(stdout.trim().split(':').at(-1));
    const config = {
      host: '127.0.0.1',
      port,
      user: 'root',
      password,
      database: 'goindica_test',
      charset: 'utf8mb4',
      timezone: 'Z',
      decimalNumbers: true,
    };
    let connection: mysql.Connection | undefined;
    for (let attempt = 0; attempt < 120; attempt++) {
      try {
        connection = await mysql.createConnection(config);
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    if (!connection) throw new Error('Disposable MySQL did not start.');
    await migrate(connection);
    await connection.end();
    db = mysql.createPool(config);
    const env = {
      MYSQL_HOST: config.host,
      MYSQL_PORT: String(port),
      MYSQL_USER: 'root',
      MYSQL_PASSWORD: password,
      MYSQL_DATABASE: 'goindica_test',
    };
    return {
      pool: db,
      env,
      close: async () => {
        await db?.end();
        await exec('docker', ['stop', name]);
        await rm(directory, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await db?.end();
    await exec('docker', ['rm', '-f', name]).catch(() => {});
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}
