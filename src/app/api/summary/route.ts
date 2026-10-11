import { NextResponse } from 'next/server';
import { apiMember } from '@/server/api-auth';
import { check } from '@/lib/errors';
import { apiError } from '@/lib/http';
export async function GET() {
  try {
    const ctx = await apiMember();
    if (!ctx) return NextResponse.json({ error: 'Entre para continuar.' }, { status: 401 });
    return NextResponse.json(check(await ctx.db.rpc('member_summary')), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return apiError(e, 'member.summary');
  }
}
