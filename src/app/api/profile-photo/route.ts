import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database/server';
import { rows, pool } from '@/lib/database/pool';
import { uuid } from '@/lib/validation/schemas';
import { apiError } from '@/lib/http';
export async function GET(request: NextRequest) {
  try {
    const id = uuid.parse(request.nextUrl.searchParams.get('id'));
    const db = await database();
    // Profile pictures have the same public visibility as their profiles and ranking entries.
    const profile = await db.from('profiles').select('id').eq('id', id).maybeSingle();
    if (profile.error) throw profile.error;
    if (!profile.data) return new NextResponse(null, { status: 404 });
    const [photo] = await rows<{ jpeg: Buffer }>(
      pool(),
      'SELECT jpeg FROM profile_photos WHERE user_id=?',
      [id],
    );
    if (!photo) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(photo.jpeg), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return apiError(error, 'profile.photo');
  }
}
