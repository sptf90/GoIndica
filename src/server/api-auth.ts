import 'server-only';
import { supabase } from '@/lib/supabase/server';
import { configured } from '@/lib/env';
import { operationalError } from '@/lib/observability';
export async function apiMember() {
  if (!configured()) return null;
  const db = await supabase();
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
      return null;
    operationalError('api.auth', error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
  if (!user) return null;
  const state = await db.rpc('account_state');
  if (state.error) {
    if (/ACCOUNT_BLOCKED|AUTH_REQUIRED/.test(state.error.message)) return null;
    operationalError('api.account', state.error);
    throw new Error('SERVICE_UNAVAILABLE');
  }
  if (!state.data.onboarded) return null;
  return { db, user, admin: state.data.admin };
}
