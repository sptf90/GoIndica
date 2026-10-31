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
      await ctx.db
        .from('requests')
        .select('status,indication_count,requester_id,hidden_at')
        .eq('id', id)
        .maybeSingle(),
    );
    if (!result || result.hidden_at) {
      return NextResponse.json({ error: 'Pedido indisponível.' }, { status: 404 });
    }
    const owner = result.requester_id === ctx.user.id;
    // Contador explícito só para o dono (uso interno de sincronização); nunca para indicadores.
    return NextResponse.json(
      owner
        ? { status: result.status, indication_count: result.indication_count }
        : { status: result.status },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e, 'request.status');
  }
}
