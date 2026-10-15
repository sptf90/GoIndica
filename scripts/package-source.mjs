import { mkdir, cp, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const target = '.hostinger-source';
await rm(target, { recursive: true, force: true });
await mkdir(target);
for (const path of [
  'src',
  'public',
  'database',
  'scripts',
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'tsconfig.json',
  'next-env.d.ts',
  'README.md',
  '.env.example',
  'docs/HOSTINGER.md',
])
  await cp(path, target + '/' + path, { recursive: true });
await rm('goindica-hostinger-fonte.zip', { force: true });
execFileSync('zip', ['-qr', '../goindica-hostinger-fonte.zip', '.'], { cwd: target });
console.log(
  'Pacote fonte criado: goindica-hostinger-fonte.zip (sem credenciais ou dados privados).',
);
