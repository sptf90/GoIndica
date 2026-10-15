import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { appUrl } from '@/lib/env';
import { check } from '@/lib/errors';
import { smallJson, apiError } from '@/lib/http';
const schema = z.object({
  kind: z.enum(['CLICKED', 'USEFUL']),
  cityId: z.number().int().positive(),
  requestId: z.uuid(),
});
export async function POST(request: NextRequest) {
  if (request.headers.get('origin') !== appUrl()) return new NextResponse(null, { status: 403 });
  try {
    const ctx = await apiMember();
    if (!ctx) return new NextResponse(null, { status: 401 });
    const input = schema.parse(await smallJson(request));
    check(
      await ctx.db.call('record_search_event', {
        p_kind: input.kind,
        p_city_id: input.cityId,
        p_request_id: input.requestId,
      }),
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return apiError(error, 'search.record');
  }
}
