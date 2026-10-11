import { NextResponse } from 'next/server';
import { environmentStatus } from '@/lib/env';
import { serviceClient } from '@/lib/supabase/admin';
import { operationalError } from '@/lib/observability';
export const runtime = 'nodejs';
export async function GET() {
  let ready = false;
  try {
    const env = environmentStatus();
    if (env.authentication && env.service) {
      const result = await serviceClient()
        .rpc('health_check')
        .abortSignal(AbortSignal.timeout(3000));
      if (result.error) throw result.error;
      ready = result.data === true;
    }
  } catch (e) {
    operationalError('health.database', e);
  }
  return NextResponse.json(
    { ready },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
