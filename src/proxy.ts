import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/supabase/database.types';
import { optionalEnv, secureCookies, configured } from '@/lib/env';
import { returnPath } from '@/lib/return-path';
import { operationalError } from '@/lib/observability';
export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://maps.gstatic.com data:",
    "font-src 'self'",
    "connect-src 'self'" + (dev ? ' ws: wss:' : ''),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self' https://accounts.google.com https://*.supabase.co",
  ].join('; ');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);
  requestHeaders.set(
    'x-auth-destination',
    returnPath(request.nextUrl.pathname + request.nextUrl.search),
  );
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const url = optionalEnv('NEXT_PUBLIC_SUPABASE_URL'),
    key = optionalEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (configured() && url && key) {
    const client = createServerClient<Database>(url, key, {
      cookieOptions: {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookies(),
        path: '/',
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (items) => {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    try {
      await client.auth.getClaims();
    } catch (error) {
      operationalError('auth.refresh', error);
    }
  }
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2)$).*)',
  ],
};
