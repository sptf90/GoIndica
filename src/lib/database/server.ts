import 'server-only';
import { cache } from 'react';
import { DatabaseClient } from './client';
// One client per render request; no cross-user session or result cache.
export const database = cache(async () => new DatabaseClient());
