import { NextRequest, NextResponse } from 'next/server';
import { authorizedCron } from '@/lib/cron-auth';
import { optionalEnv } from '@/lib/env';
import { apiError } from '@/lib/http';
import { serviceClient } from '@/lib/database/admin';
import { check } from '@/lib/errors';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  if (!authorizedCron(request.headers.get('authorization'), optionalEnv('CRON_SECRET')))
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try {
    const closed = check(await serviceClient().call('expire_evaluation_deadlines', {}));
    return NextResponse.json({ closed }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e, 'evaluations.expire');
  }
}
