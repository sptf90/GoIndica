import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import { execFile, spawn } from 'node:child_process';
import { SMTPServer } from 'smtp-server';
import { simpleParser } from 'mailparser';
import { testDatabase } from '../integration/database';
import { password } from './helpers';
import { hashPassword } from '../../src/lib/auth/crypto';
const exec = promisify(execFile),
  db = await testDatabase(),
  directory = await mkdtemp(join(tmpdir(), 'goindica-smtp-'));
await exec('openssl', [
  'req',
  '-x509',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-keyout',
  join(directory, 'key.pem'),
  '-out',
  join(directory, 'cert.pem'),
  '-days',
  '1',
  '-subj',
  '/CN=localhost',
  '-addext',
  'subjectAltName=DNS:localhost',
]);
const mail = new Map<string, { tokenHash: string; type: string; url: string }>();
const smtp = new SMTPServer({
  secure: true,
  key: await readFile(join(directory, 'key.pem')),
  cert: await readFile(join(directory, 'cert.pem')),
  authOptional: false,
  onAuth(auth, session, callback) {
    if (auth.username === 'mail@test.invalid' && auth.password === 'local-smtp-password')
      callback(null, { user: 'fixture' });
    else callback(new Error('Invalid SMTP credentials'));
  },
  onData(stream, session, callback) {
    void simpleParser(stream)
      .then((message) => {
        const url = message.text?.match(/http:\/\/localhost:3100\/auth\/confirm\?[^\s]+/)?.[0];
        if (url) {
          const parsed = new URL(url);
          for (const recipient of session.envelope.rcptTo)
            mail.set(recipient.address, {
              url,
              tokenHash: parsed.searchParams.get('token_hash')!,
              type: parsed.searchParams.get('type')!,
            });
        }
        callback();
      })
      .catch(callback);
  },
});
await new Promise<void>((resolve) => smtp.listen(3465, '127.0.0.1', resolve));
const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://localhost:3456');
  if (url.pathname === '/test-reset-limits' && req.method === 'POST') {
    void db.pool
      .execute('DELETE FROM rate_limits')
      .then(() => {
        res.statusCode = 204;
        res.end();
      })
      .catch(() => {
        res.statusCode = 500;
        res.end();
      });
    return;
  }
  const provider = url.pathname.match(/^\/(cnpj|cnpj-alt)\/(\w+)$/);
  if (provider) {
    const [, source, cnpj] = provider;
    const company = (
      (source === 'cnpj'
        ? {
            '19131243000197': ['OPEN KNOWLEDGE BRASIL', 'REDE PELO CONHECIMENTO LIVRE', 'ATIVA'],
            '00000000000272': ['EMPRESA ENCERRADA LTDA', '', 'BAIXADA'],
          }
        : { '11444777000161': ['MERCADO RESERVA LTDA', '', 'ATIVA'] }) as Record<string, string[]>
    )[cnpj];
    res.setHeader('Content-Type', 'application/json');
    if (cnpj === '12ABC34501DE35') res.statusCode = 404;
    else if (!company) res.statusCode = source === 'cnpj' ? 403 : 502;
    res.end(
      JSON.stringify(
        company
          ? {
              razao_social: company[0],
              nome_fantasia: company[1],
              descricao_situacao_cadastral: company[2],
              codigo_municipio_ibge: 3549805,
              descricao_identificador_matriz_filial: 'MATRIZ',
            }
          : { message: 'indisponível' },
      ),
    );
    return;
  }
  if (url.pathname === '/test-mail') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(mail.get(url.searchParams.get('email') || '') || null));
    return;
  }
  res.statusCode = 404;
  res.end();
});
await new Promise<void>((resolve) => server.listen(3456, '127.0.0.1', resolve));
const usernames = ['ana', 'joao', 'admin', 'bruno', 'lia', 'paula', 'diego', 'rita', 'carla'];
const hash = await hashPassword(password);
for (const name of usernames) {
  const id = randomUUID();
  await db.pool.execute(
    'INSERT INTO users(id,email,password_hash,email_confirmed_at) VALUES(?,?,?,UTC_TIMESTAMP(3))',
    [id, name + '_teste@test.invalid', hash],
  );
  await db.pool.execute('INSERT INTO accounts(id,is_admin) VALUES(?,?)', [id, name === 'admin']);
}
for (const [name, address] of [
  ['Empório A', 'Rua A, 10, Centro'],
  ['Empório B', 'Rua B, 20, Centro'],
])
  await db.pool.execute(
    'INSERT INTO places(id,city_id,name,address,normalized_name) VALUES(?,?,?,?,?)',
    [
      randomUUID(),
      3549805,
      name,
      address,
      name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''),
    ],
  );
const child = spawn(process.execPath, ['scripts/start.mjs'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...db.env,
    PORT: '3100',
    HOSTNAME: '127.0.0.1',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3100',
    NEXT_PUBLIC_SUPPORT_EMAIL: 'mail@test.invalid',
    SMTP_HOST: 'localhost',
    SMTP_PORT: '3465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'mail@test.invalid',
    SMTP_PASSWORD: 'local-smtp-password',
    SMTP_CA_FILE: join(directory, 'cert.pem'),
    EMAIL_FROM: 'GoIndica <mail@test.invalid>',
    CRON_SECRET: 'local-fixture-cron-secret-12345678901234567890',
    CNPJ_API_URL: 'http://localhost:3456/cnpj/,http://localhost:3456/cnpj-alt/',
  },
});
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  child.kill('SIGTERM');
  await new Promise<void>((r) => child.once('exit', () => r()));
  server.close();
  smtp.close();
  await db.close();
  await rm(directory, { recursive: true, force: true });
  process.exit(0);
}
process.on('SIGINT', () => void close());
process.on('SIGTERM', () => void close());
child.on('exit', () => {
  if (!closing) void close();
});
