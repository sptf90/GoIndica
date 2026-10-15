import 'server-only';
import { cache } from 'react';
import { check } from '@/lib/errors';
import { database } from '@/lib/database/server';
import type { LocalRequest, City } from '@/lib/types';
import type { Resolution } from '@/lib/types';
export function date(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'medium',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}
export function timestamp(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}
export async function citiesFor(requests: LocalRequest[]) {
  if (!requests.length) return new Map<number, City>();
  const db = await database();
  const rows = check(
    await db
      .from('cities')
      .select('*')
      .in('id', [...new Set(requests.map((r) => r.city_id))]),
  );
  return new Map(rows.map((c) => [c.id, c]));
}
export async function resolutionsFor(requests: LocalRequest[]) {
  const ids = requests
    .filter((r) => r.status === 'RESOLVED' || r.status === 'CLOSED_NO_RESULT')
    .map((r) => r.id);
  if (!ids.length) return new Map<string, Resolution>();
  const db = await database();
  const rows = check(await db.from('request_resolutions').select('*').in('request_id', ids));
  return new Map(rows.map((r) => [r.request_id, r]));
}

export const memberSummary = cache(async () => {
  const db = await database();
  return check(await db.call('member_summary'));
});
