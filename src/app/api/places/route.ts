import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { autocomplete, registerPlace } from '@/lib/places';
import { searchSchema, placeSchema } from '@/lib/validation/schemas';
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
    return NextResponse.json(await autocomplete(input.input, city), {
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
    const input = placeSchema.parse(await smallJson(request, 2048));
    const id = await registerPlace(ctx.user.id, input.cityId, input.name, input.address);
    return NextResponse.json({ id, label: input.name + ', ' + input.address }, { status: 201 });
  } catch (error) {
    return apiError(error, 'places.create');
  }
}
