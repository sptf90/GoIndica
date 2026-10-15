import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { cityId } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { resolutionsFor } from '@/server/queries';
import { apiError } from '@/lib/http';
import { operationalError } from '@/lib/observability';
export async function GET(request: NextRequest) {
  try {
    const ctx = await apiMember();
    if (!ctx)
      return NextResponse.json(
        { error: 'Entre e complete seu perfil para continuar.' },
        { status: 401 },
      );
    const { db } = ctx;
    const city = cityId.parse(request.nextUrl.searchParams.get('cityId'));
    const q = (request.nextUrl.searchParams.get('q') || '').trim().slice(0, 300);
    if (q.length < 3) return NextResponse.json([]);
    const results = check(
      await db.call('search_requests', { p_city_id: city, p_query: q, p_status: 'RESOLVED' }),
    ).slice(0, 5);
    const resolutions = await resolutionsFor(results);
    const event = await db.call('record_search_event', {
      p_kind: results.length ? 'MATCHED' : 'NO_RESULT',
      p_city_id: city,
    });
    if (event.error) operationalError('search.metrics', event.error);
    return NextResponse.json(
      results.map((r) => ({ ...r, resolution: resolutions.get(r.id) || null })),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e, 'search.resolved');
  }
}
