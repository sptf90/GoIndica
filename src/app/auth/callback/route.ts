import { NextResponse } from 'next/server';
import { appUrl } from '@/lib/env';
// Old OAuth/PKCE callbacks are retired. Local email links use /auth/confirm.
export async function GET() {
  return NextResponse.redirect(appUrl() + '/entrar?motivo=link_expirado');
}
