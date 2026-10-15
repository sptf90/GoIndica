import { NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';

export async function GET(request: Request) {
  try {
    const auth = await apiMember();
    if (!auth) throw new Error('AUTH_REQUIRED');
    const id = uuid.parse(new URL(request.url).searchParams.get('id'));
    const photo = check(await auth.db.call('request_photo', { p_request_id: id }));
    if (!photo)
      return new NextResponse(null, {
        status: 404,
        headers: { 'Cache-Control': 'private, no-store' },
      });
    return new NextResponse(Buffer.from(photo, 'base64'), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error, 'request.photo');
  }
}
