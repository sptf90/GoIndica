import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { selectGooglePlace, registerPlace } from '@/lib/places';
import { autocomplete } from '@/lib/google-places';
import { searchSchema, placeSchema, googleSelectionSchema } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError, smallJson } from '@/lib/http';
export async function GET(request: NextRequest) {
  try {
    const ctx = await apiMember();
    if (!ctx)
      return NextResponse.json(
        { error: 'Entre e complete seu perfil para continuar.' },
        { status: 401 },
      );
    const { db } = ctx;
    const input = searchSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    check(await db.call('consume_api_limit', { p_bucket: 'places_search' }));
    const city = check(await db.from('cities').select('*').eq('id', input.cityId).single());
    return NextResponse.json(await autocomplete(input.input, city, input.sessionToken), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e, 'places.autocomplete');
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== request.nextUrl.origin) throw new Error('NOT_ALLOWED');
    const ctx = await apiMember();
    if (!ctx)
      return NextResponse.json({ error: 'Entre para cadastrar um local.' }, { status: 401 });
    const body = await smallJson(request, 2048);
    if (body && typeof body === 'object' && 'googlePlaceId' in body) {
      const input = googleSelectionSchema.parse(body);
      check(await ctx.db.call('consume_api_limit', { p_bucket: 'places_details' }));
      const city = check(await ctx.db.from('cities').select('*').eq('id', input.cityId).single());
      return NextResponse.json(
        await selectGooglePlace(ctx.user.id, city, input.googlePlaceId, input.sessionToken),
        {
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
    const input = placeSchema.parse(body);
    const id = await registerPlace(ctx.user.id, input.cityId, input.name, input.address);
    return NextResponse.json(
      { id, label: input.name + ', ' + input.address },
      { status: 201, headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return apiError(error, 'places.create');
  }
}
