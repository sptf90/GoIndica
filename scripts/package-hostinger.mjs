import { cp, mkdir, rm, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const dist = process.env.NEXT_DIST_DIR || '.next';
await access(dist + '/standalone/server.js');
await rm('.hostinger-package', { recursive: true, force: true });
await mkdir('.hostinger-package', { recursive: true });
await cp(dist + '/standalone', '.hostinger-package', {
  recursive: true,
  filter: (path) => !/(?:^|\/)\.env(?:\.|$)/.test(path),
});
await cp(dist + '/static', '.hostinger-package/' + dist + '/static', { recursive: true });
await cp('public', '.hostinger-package/public', { recursive: true });
execFileSync('tar', ['-czf', 'goindica-hostinger.tar.gz', '-C', '.hostinger-package', '.']);
await rm('goindica-hostinger.zip', { force: true });
execFileSync('zip', ['-qr', '../goindica-hostinger.zip', '.'], { cwd: '.hostinger-package' });
console.log(
  'Pacote criado: goindica-hostinger.zip e .tar.gz. Configure variáveis no hPanel e execute server.js com Node 24.',
);
