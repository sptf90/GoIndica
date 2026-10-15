import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database/server';
import { citySearch } from '@/lib/city-search';
import { safeError } from '@/lib/errors';
export async function GET(request: NextRequest) {
  const { query: q, state } = citySearch(request.nextUrl.searchParams.get('q') || '');
  if (q.length < 2) return NextResponse.json([]);
  try {
    const db = await database();
    let query = db
      .from('cities')
      .select('*')
      .ilike('normalized_name', '%' + q + '%')
      .order('name')
      .order('state_code')
      .limit(20);
    if (state) query = query.eq('state_code', state);
    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json(data, { headers: { 'Cache-Control': 'public, max-age=3600' } });
  } catch (e) {
    return NextResponse.json(safeError(e), { status: 503 });
  }
}
