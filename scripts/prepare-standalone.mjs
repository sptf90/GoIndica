import { cp } from 'node:fs/promises';
const dist = process.env.NEXT_DIST_DIR || '.next';
await cp('public', dist + '/standalone/public', { recursive: true });
await cp(dist + '/static', dist + '/standalone/' + dist + '/static', { recursive: true });
