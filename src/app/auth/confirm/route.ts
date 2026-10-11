import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { appUrl, configured } from '@/lib/env';
import { callbackDestination } from '@/lib/return-path';

// Only these two purposes are accepted; no caller-controlled redirect URL is used.
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type');
  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const failed =
    type === 'recovery' ? '/recuperar-senha?motivo=link_expirado' : '/entrar?motivo=link_expirado';
  if (
    configured() &&
    (type === 'email' || type === 'recovery') &&
    tokenHash &&
    /^[A-Za-z0-9_-]{16,512}$/.test(tokenHash)
  ) {
    try {
      const db = await supabase();
      const { error } = await db.auth.verifyOtp({ type, token_hash: tokenHash });
      if (!error) {
        await db.rpc('log_login');
        return NextResponse.redirect(
          appUrl() +
            (type === 'recovery'
              ? '/nova-senha'
              : callbackDestination(request.nextUrl.searchParams.get('next'), appUrl())),
        );
      }
    } catch {
      // Treat invalid links and unavailable providers as a recoverable authentication error.
    }
  }
  return NextResponse.redirect(appUrl() + failed);
}
