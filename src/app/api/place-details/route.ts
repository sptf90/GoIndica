import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
import { placeDetails } from '@/lib/places';
export async function GET(request: NextRequest) {
  try {
    const ctx = await apiMember();
    if (!ctx)
      return NextResponse.json(
        { error: 'Seu acesso expirou. Entre novamente para consultar o local.' },
        { status: 401 },
      );
    const requestId = uuid.parse(request.nextUrl.searchParams.get('requestId'));
    const placeId = uuid.parse(request.nextUrl.searchParams.get('placeId'));
    const row = check(
      await ctx.db
        .from('requests')
        .select('id,requester_id,status,hidden_at')
        .eq('id', requestId)
        .maybeSingle(),
    );
    if (!row || (row.hidden_at && !ctx.admin)) throw new Error('NOT_ALLOWED');
    let allowed = ctx.admin;
    if (
      !allowed &&
      row.requester_id === ctx.user.id &&
      ['REVEALED', 'RESOLVED', 'CLOSED_NO_RESULT'].includes(row.status)
    ) {
      const indication = check(
        await ctx.db
          .from('indications')
          .select('id')
          .eq('request_id', requestId)
          .eq('place_id', placeId)
          .limit(1),
      );
      allowed = indication.length > 0;
    }
    if (!allowed && row.status === 'RESOLVED') {
      const resolution = check(
        await ctx.db
          .from('request_resolutions')
          .select('place_id')
          .eq('request_id', requestId)
          .maybeSingle(),
      );
      allowed = resolution?.place_id === placeId;
    }
    if (!allowed) throw new Error('NOT_ALLOWED');
    // The database client applies the same visibility rules to every read.
    const place = check(await ctx.db.from('places').select('id').eq('id', placeId).maybeSingle());
    if (!place) throw new Error('NOT_ALLOWED');
    check(await ctx.db.call('consume_api_limit', { p_bucket: 'places_view' }));
    return NextResponse.json(await placeDetails(place.id), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return apiError(error, 'places.view');
  }
}
