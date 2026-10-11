import { NextRequest, NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { uuid } from '@/lib/validation/schemas';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
export async function GET(request: NextRequest) {
  try {
    const ctx = await apiMember();
    if (!ctx) return NextResponse.json({ error: 'Entre para continuar.' }, { status: 401 });
    const id = uuid.parse(request.nextUrl.searchParams.get('id'));
    const result = check(
      await ctx.db.from('requests').select('status,indication_count').eq('id', id).maybeSingle(),
    );
    if (!result) return NextResponse.json({ error: 'Pedido indisponível.' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return apiError(e, 'request.status');
  }
}
