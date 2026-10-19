import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
process.env.HOSTNAME ||= '0.0.0.0';
await import(pathToFileURL(resolve('.next/standalone/server.js')).href);
