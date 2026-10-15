import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const dist = process.env.NEXT_DIST_DIR || '.next';
process.env.HOSTNAME ||= '0.0.0.0';
await import(pathToFileURL(resolve(dist, 'standalone/server.js')).href);
