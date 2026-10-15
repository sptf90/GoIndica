import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { appUrl, configured } from '@/lib/env';
import { serviceClient } from '@/lib/database/admin';
import { check } from '@/lib/errors';
import { smallJson, apiError } from '@/lib/http';
const schema = z.object({ event: z.enum(['LANDING_VISIT', 'CTA_CLICK', 'SEARCH_REUSED']) });
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== appUrl()) return new NextResponse(null, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > 128)
    return new NextResponse(null, { status: 413 });
  if (!configured() || !process.env.CRON_SECRET)
    return new NextResponse(null, { status: 204 });
  try {
    const { event } = schema.parse(await smallJson(request, 128));
    const key = 'event_' + event.toLowerCase();
    const response = new NextResponse(null, { status: 204 });
    if (!request.cookies.has(key)) {
      check(
        await serviceClient().call('record_analytics', {
          p_event: event,
          p_fingerprint: createHmac('sha256', process.env.CRON_SECRET!)
            .update((request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').trim())
            .digest('hex'),
        }),
      );
      response.cookies.set(key, '1', {
        httpOnly: true,
        sameSite: 'lax',
        secure: appUrl().startsWith('https:'),
        maxAge: 1800,
        path: '/',
      });
    }
    return response;
  } catch (error) {
    return apiError(error, 'analytics.record');
  }
}
