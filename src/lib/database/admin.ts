import 'server-only';
import { DatabaseClient } from './client';
// Internal jobs only. Never exported through a route or accepted from browser input.
export function serviceClient() {
  return new DatabaseClient(true);
}
