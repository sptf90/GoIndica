import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/server';
import { appUrl, configured } from '@/lib/env';
import { returnPath } from '@/lib/return-path';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code && configured()) {
    try {
      const db = await supabase();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) {
        await db.rpc('log_login');
        const destination =
          request.nextUrl.searchParams.get('destino') === 'senha'
            ? '/nova-senha'
            : returnPath(request.nextUrl.searchParams.get('next'));
        return NextResponse.redirect(appUrl() + destination);
      }
    } catch {
      // A provider outage must not expose its response or tokens to the visitor.
    }
  }
  if (request.nextUrl.searchParams.get('destino') === 'senha')
    return NextResponse.redirect(appUrl() + '/recuperar-senha?motivo=link_expirado');
  return NextResponse.redirect(appUrl() + '/entrar?motivo=falha');
}
