import 'server-only';
// Read server configuration at runtime, including when a built app changes environment.
export function optionalEnv(name: string): string | undefined {
  return process.env[name];
}
export function configured() {
  return ['MYSQL_HOST', 'MYSQL_DATABASE', 'MYSQL_USER', 'MYSQL_PASSWORD'].every((name) =>
    Boolean(optionalEnv(name) && !placeholder(optionalEnv(name)!)),
  );
}
function placeholder(value: string) {
  return /your-|example\.com|your-project/i.test(value);
}
function validUrl(value: string | undefined) {
  try {
    const url = new URL(value || '');
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      !placeholder(value!)
    );
  } catch {
    return false;
  }
}
export function pilotCityId() {
  const value = optionalEnv('PILOT_CITY_ID') || '3549805';
  if (!/^\d{7}$/.test(value)) throw new Error('CONFIGURATION_REQUIRED');
  return Number(value);
}
export function environmentStatus() {
  const present = (name: string) => Boolean(optionalEnv(name) && !placeholder(optionalEnv(name)!));
  return {
    authentication: configured(),
    app_url: validUrl(optionalEnv('NEXT_PUBLIC_APP_URL')),
    database: configured(),
    email: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD', 'EMAIL_FROM'].every(present),
    scheduler: (optionalEnv('CRON_SECRET')?.length || 0) >= 32,
    support: present('NEXT_PUBLIC_SUPPORT_EMAIL'),
    pilot_city: /^\d{7}$/.test(optionalEnv('PILOT_CITY_ID') || '3549805'),
  };
}
export function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value || placeholder(value)) throw new Error('CONFIGURATION_REQUIRED');
  return value;
}
export function appUrl() {
  const value = optionalEnv('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000';
  if (!validUrl(value)) throw new Error('CONFIGURATION_REQUIRED');
  return new URL(value).origin;
}
export const secureCookies = () => new URL(appUrl()).protocol === 'https:';
