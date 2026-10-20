import { NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const auth = await apiMember();
    if (!auth) throw new Error('AUTH_REQUIRED');
    const search = new URL(request.url).searchParams;
    const id = uuid.parse(search.get('id'));
    const origin = uuid.safeParse(search.get('pedido'));
    const photo = check(
      await auth.db.call('profile_photo', {
        p_profile_id: id,
        p_request_id: origin.success ? origin.data : '',
        p_ranking_city_id: Number(search.get('ranking')) || 0,
      }),
    );
    if (!photo)
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    return new NextResponse(Buffer.from(photo, 'base64'), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error, 'profile.photo');
  }
}
