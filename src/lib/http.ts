import { z } from 'zod';
import { NextResponse } from 'next/server';
import { safeError } from './errors';
import { operationalError } from './observability';

export async function smallJson(request: Request, maximum = 1024): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > maximum) throw new Error('BODY_TOO_LARGE');
  if (!request.body) throw new Error('INVALID_INPUT');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximum) {
      await reader.cancel();
      throw new Error('BODY_TOO_LARGE');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('INVALID_INPUT');
  }
}

export function apiError(error: unknown, context: string) {
  const message =
    error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  const status = message.includes('RATE_LIMITED')
    ? 429
    : message.includes('BODY_TOO_LARGE')
      ? 413
      : /AUTH_REQUIRED|ACCOUNT_BLOCKED|ONBOARDING_REQUIRED/.test(message)
        ? 401
        : message.includes('NOT_ALLOWED')
          ? 403
          : error instanceof z.ZodError || /INVALID_INPUT|INVALID_CITY|INVALID_PLACE/.test(message)
            ? 400
            : 503;
  if (status === 503) operationalError(context, error);
  return NextResponse.json(safeError(error), {
    status,
    headers: { 'Cache-Control': 'no-store', ...(status === 429 ? { 'Retry-After': '60' } : {}) },
  });
}
