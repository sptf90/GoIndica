import 'server-only';
// Read server configuration at runtime, including when a built app changes environment.
export function optionalEnv(name: string): string | undefined {
  return process.env[name];
}
export function configured() {
  const key = optionalEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  return validUrl(optionalEnv('NEXT_PUBLIC_SUPABASE_URL')) && Boolean(key && !placeholder(key));
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
    places: present('GOOGLE_PLACES_API_KEY'),
    service: present('SUPABASE_SERVICE_ROLE_KEY'),
    email: present('RESEND_API_KEY') && present('EMAIL_FROM'),
    scheduler: (optionalEnv('CRON_SECRET')?.length || 0) >= 32,
    google_login: googleLoginEnabled(),
    support: present('NEXT_PUBLIC_SUPPORT_EMAIL'),
    pilot_city: /^\d{7}$/.test(optionalEnv('PILOT_CITY_ID') || '3549805'),
  };
}
export function googleLoginEnabled() {
  return process.env.GOOGLE_OAUTH_ENABLED === 'true';
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
