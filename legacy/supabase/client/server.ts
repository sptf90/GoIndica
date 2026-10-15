import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from './database.types';
import { requiredEnv, secureCookies } from '@/lib/env';
export async function supabase() {
  const store = await cookies();
  return createServerClient<Database>(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'),
    {
      cookieOptions: { httpOnly: true, sameSite: 'lax', secure: secureCookies(), path: '/' },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (items) => {
          try {
            items.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            /* Server Components cannot write; proxy refreshes sessions. */
          }
        },
      },
    },
  );
}
