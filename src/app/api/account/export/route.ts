import { NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
export async function GET() {
  try {
    const ctx = await apiMember();
    if (!ctx)
      return NextResponse.json({ error: 'Entre para exportar seus dados.' }, { status: 401 });
    const data = check(await ctx.db.rpc('export_account'));
    return new NextResponse(
      JSON.stringify(
        {
          account: {
            id: ctx.user.id,
            email: ctx.user.email,
            created_at: ctx.user.created_at,
            last_sign_in_at: ctx.user.last_sign_in_at,
            providers: ctx.user.app_metadata.providers,
          },
          data,
        },
        null,
        2,
      ),
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': 'attachment; filename="goindica-meus-dados.json"',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  } catch (e) {
    return apiError(e, 'account.export');
  }
}
