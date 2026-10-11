import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { autocomplete } from '@/lib/google/places';
import { searchSchema } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
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
    check(await db.rpc('consume_api_limit', { p_bucket: 'places_search' }));
    const city = check(await db.from('cities').select('*').eq('id', input.cityId).single());
    return NextResponse.json(await autocomplete(input.input, city, input.sessionToken), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e, 'places.autocomplete');
  }
}
