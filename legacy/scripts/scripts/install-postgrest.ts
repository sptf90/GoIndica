import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
if (process.platform !== 'linux' || process.arch !== 'x64')
  throw new Error('Defina POSTGREST_BIN para seu sistema. O instalador fixado é Linux x64.');
const directory = await mkdtemp(join(tmpdir(), 'goindica-postgrest-'));
try {
  const response = await fetch(
    'https://github.com/PostgREST/postgrest/releases/download/v16.4/postgrest-v16.4-linux-static-x86-64.tar.xz',
    { signal: AbortSignal.timeout(120000) },
  );
  if (!response.ok) throw new Error('Download indisponível');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (
    createHash('sha256').update(bytes).digest('hex') !==
    'b47ecc82fce1dcebbbc4183d839e52f07f7630c9d7ad0f54db753d1939299354'
  )
    throw new Error('Checksum do PostgREST não corresponde à release');
  const archive = join(directory, 'postgrest.tar.xz');
  await writeFile(archive, bytes);
  await mkdir('.test-tools', { recursive: true });
  await promisify(execFile)('tar', ['-xJf', archive, '-C', resolve('.test-tools'), 'postgrest']);
  console.log('PostgREST v16.4 instalado em .test-tools/postgrest com SHA-256 verificado.');
} finally {
  await rm(directory, { recursive: true, force: true });
}
