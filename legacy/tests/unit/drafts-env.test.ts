import { afterEach, test, expect, vi } from 'vitest';
import { parseDraft } from '@/lib/drafts';
import { authorizedCron } from '@/lib/cron-auth';
import { configured, environmentStatus, pilotCityId } from '@/lib/env';
import { operationalError } from '@/lib/observability';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const now = 1800000000000;
const draft = {
  version: 1,
  description: 'Peça para café',
  neighborhood: 'Centro',
  savedAt: now,
  city: {
    id: 3549805,
    name: 'São José do Rio Preto',
    normalized_name: 'sao jose do rio preto',
    state_name: 'São Paulo',
    state_code: 'SP',
    country_name: 'Brasil',
    country_code: 'BR',
    slug: 'sao-jose-do-rio-preto-sp',
  },
};
test('rascunho válido preserva texto e cidade; inválido, antigo ou futuro não é restaurado', () => {
  expect(parseDraft(JSON.stringify(draft), now)).toEqual(draft);
  expect(parseDraft(JSON.stringify({ ...draft, savedAt: now - 7 * 86400000 }), now)).toBeNull();
  expect(parseDraft(JSON.stringify({ ...draft, savedAt: now + 1 }), now)).toBeNull();
  expect(parseDraft(JSON.stringify({ ...draft, description: 'a'.repeat(301) }), now)).toBeNull();
  expect(parseDraft('{', now)).toBeNull();
});
test('configuração incompleta e exemplos não são tratados como serviços prontos', () => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://your-project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'your-public-publishable-key');
  expect(configured()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'javascript:alert(1)');
  expect(configured()).toBe(false);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  expect(configured()).toBe(true);
  expect(JSON.stringify(environmentStatus())).not.toContain('sb_publishable_test');
});
test('cidade piloto pode ser alterada e rejeita identificador inválido', () => {
  vi.stubEnv('PILOT_CITY_ID', '3530300');
  expect(pilotCityId()).toBe(3530300);
  vi.stubEnv('PILOT_CITY_ID', 'abc');
  expect(() => pilotCityId()).toThrow('CONFIGURATION_REQUIRED');
});
test('worker recusa segredo ausente, curto, diferente e aceita bearer exato', () => {
  const secret = 's'.repeat(32);
  expect(authorizedCron('Bearer ' + secret, secret)).toBe(true);
  expect(authorizedCron('Bearer ' + secret + 'x', secret)).toBe(false);
  expect(authorizedCron('Bearer ' + secret, 's'.repeat(31))).toBe(false);
  expect(authorizedCron(null, secret)).toBe(false);
});
test('logs operacionais não expõem mensagem, e-mail, token nem caminho da requisição', () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  operationalError('auth.user', {
    message: 'email@user.invalid token=secret',
    code: 'CUSTOM_SECRET',
  });
  const output = String(log.mock.calls[0][0]);
  expect(output).not.toContain('email@');
  expect(output).not.toContain('secret');
  expect(output).not.toContain('CUSTOM_SECRET');
  expect(output).toContain('auth.user');
});
