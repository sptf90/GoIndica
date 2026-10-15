import { existsSync } from 'node:fs';
export function loadEnvironment() {
  const argument = process.argv.find((value) => value.startsWith('--env='));
  const file = argument?.slice(6) || (existsSync('.env.local') ? '.env.local' : undefined);
  if (file) process.loadEnvFile(file);
}
