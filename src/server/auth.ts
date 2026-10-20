import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { database } from '@/lib/database/server';
import { configured } from '@/lib/env';
import { accessLink, returnPath } from '@/lib/return-path';
import { operationalError } from '@/lib/observability';
import { companyFor } from '@/lib/company';
export const session = cache(async () => {
  const destination = returnPath((await headers()).get('x-auth-destination'));
  if (!configured()) redirect('/entrar?motivo=configuracao');
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error) {
    if (
      error.name === 'AuthSessionMissingError' ||
      error.status === 401 ||
      error.code === 'refresh_token_not_found'
    )
      redirect(accessLink('/entrar', destination));
    operationalError('auth.user', error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
  if (!user || user.sessionPurpose === 'recovery') redirect(accessLink('/entrar', destination));
  const [state, profile] = await Promise.all([
    db.call('account_state'),
    db.from('profiles').select('*').eq('id', user.id).maybeSingle(),
  ]);
  if (state.error) {
    if (state.error.code === 'PGRST202' || state.error.code === '42P01')
      redirect('/entrar?motivo=banco');
    if (state.error.message.includes('ACCOUNT_BLOCKED')) redirect('/entrar?motivo=bloqueado');
    if (state.error.message.includes('AUTH_REQUIRED')) redirect(accessLink('/entrar', destination));
    operationalError('auth.account', state.error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
  if (!state.data) throw new Error('SERVICE_UNAVAILABLE');
  if (profile.error) {
    operationalError('auth.profile', profile.error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
  return {
    db,
    user,
    profile: profile.data,
    admin: state.data.admin,
    kind: state.data.kind,
    destination,
  };
});
export const member = cache(async () => {
  const ctx = await session();
  if (ctx.kind === 'company') redirect('/empresa');
  if (!ctx.profile) redirect(accessLink('/onboarding', ctx.destination));
  return { ...ctx, profile: ctx.profile };
});
export const company = cache(async () => {
  const ctx = await session();
  if (ctx.kind !== 'company') redirect(ctx.profile ? '/app' : '/onboarding');
  const data = await companyFor(ctx.user.id);
  if (!data) redirect('/cadastro?tipo=empresa');
  return { ...ctx, company: data };
});
export async function administrator() {
  const ctx = await member();
  if (!ctx.admin) redirect('/app');
  return ctx;
}
