import 'server-only';

const knownCodes = new Set([
  'RATE_LIMITED',
  'ACCOUNT_BLOCKED',
  'AUTH_REQUIRED',
  'PGRST202',
  '42P01',
  '23505',
  'PLACES_UNAVAILABLE',
  'CONFIGURATION_REQUIRED',
  'SERVICE_UNAVAILABLE',
]);
export function operationalError(context: string, error: unknown) {
  const candidate =
    error && typeof error === 'object' && 'code' in error
      ? String(error.code)
      : error instanceof Error
        ? error.message
        : '';
  const code = knownCodes.has(candidate) ? candidate : 'UNEXPECTED_ERROR';
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'operation_failed',
      context: /^[a-z0-9_.-]{1,64}$/.test(context) ? context : 'application',
      code,
      at: new Date().toISOString(),
    }),
  );
}
